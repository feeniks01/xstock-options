"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { RefreshCw, Info, CheckCircle, Clock, AlertCircle, Zap, Loader2, ExternalLink, Wallet, Radio, Play, Square } from "lucide-react";
import { useVault } from "../../../../hooks/useVault";
import { useRfq } from "../../../../hooks/useRfq";
import { getVaultTheme, type VaultTheme } from "../../../../themes/vaultThemes";

const PYTH_FEEDS: Record<string, string> = {
    nvdax: "0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    tslax: "0x47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    spyx: "0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    aaplx: "0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    metax: "0xbf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900",
};

const VAULT_METADATA: Record<string, {
    name: string;
    symbol: string;
    strategy: string;
    tier: string;
    strikeOffset: number;
    apy: number;
    isLive: boolean;
    premiumRange: [number, number];
    decimals: number;
    logo: string;
}> = {
    nvdax: { name: "NVDAx Vault", symbol: "NVDAx", strategy: "Covered Call", tier: "Normal", strikeOffset: 0.10, apy: 12.4, isLive: true, premiumRange: [0.8, 1.2], decimals: 6, logo: "/nvidiax_logo.png" },
    aaplx: { name: "AAPLx Vault", symbol: "AAPLx", strategy: "Covered Call", tier: "Conservative", strikeOffset: 0.05, apy: 8.2, isLive: false, premiumRange: [0.4, 0.7], decimals: 6, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6849799260ee65bf38841f90_Ticker%3DAAPL%2C%20Company%20Name%3DApple%20Inc.%2C%20size%3D256x256.svg" },
    tslax: { name: "TSLAx Vault", symbol: "TSLAx", strategy: "Covered Call", tier: "Aggressive", strikeOffset: 0.08, apy: 18.6, isLive: false, premiumRange: [1.2, 2.0], decimals: 6, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg" },
    spyx: { name: "SPYx Vault", symbol: "SPYx", strategy: "Covered Call", tier: "Conservative", strikeOffset: 0.05, apy: 6.5, isLive: false, premiumRange: [0.3, 0.5], decimals: 6, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685116624ae31d5ceb724895_Ticker%3DSPX%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg" },
    metax: { name: "METAx Vault", symbol: "METAx", strategy: "Covered Call", tier: "Normal", strikeOffset: 0.10, apy: 15.2, isLive: false, premiumRange: [1.0, 1.5], decimals: 6, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg" },
};

const HERMES_URL = "https://hermes.pyth.network";

function PayoffChart({ spotPrice, strikePrice, premiumRange }: { spotPrice: number; strikePrice: number; premiumRange: [number, number] }) {
    const capGain = ((strikePrice - spotPrice) / spotPrice) * 100;
    const currentBarIndex = 11;

    return (
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Epoch Payoff</span>
                <span className="text-xs text-gray-500">Max upside: +{capGain.toFixed(0)}%</span>
            </div>
            <div className="relative h-20">
                <div className="absolute inset-0 flex items-end gap-0.5">
                    {Array.from({ length: 24 }).map((_, i) => {
                        const height = i < 12 ? 28 : i < 18 ? 28 + (i - 12) * 9 : 82;
                        const capped = i >= 18;
                        const isCurrent = i === currentBarIndex;
                        return (
                            <div
                                key={i}
                                className={`flex-1 rounded-t transition-all ${capped ? 'bg-yellow-500/50' : 'bg-green-500/50'} ${isCurrent ? 'ring-2 ring-white/60' : ''}`}
                                style={{ height: `${Math.min(height, 82)}%` }}
                            />
                        );
                    })}
                </div>
                <div className="absolute left-[47%] top-0 bottom-0 w-0.5 bg-white/40" />
                <div className="absolute left-[47%] top-0 -translate-x-1/2 text-[10px] text-white/70 bg-gray-900/90 px-1.5 py-0.5 rounded">now</div>
                <div className="absolute left-2 bottom-1 text-xs bg-gray-900/90 px-1.5 py-0.5 rounded">
                    <span className="text-green-400 font-medium">+{premiumRange[0]}-{premiumRange[1]}%</span>
                </div>
                <div className="absolute right-2 top-1 text-xs bg-gray-900/90 px-1.5 py-0.5 rounded">
                    <span className="text-yellow-400">cap ${strikePrice.toFixed(0)}</span>
                </div>
            </div>
        </div>
    );
}

export default function VaultDetailPage() {
    const params = useParams();
    const ticker = params.ticker as string;
    const vaultMeta = VAULT_METADATA[ticker];
    const { connected, publicKey } = useWallet();

    // Get vault-specific theme colors
    const theme = getVaultTheme(vaultMeta?.symbol || "NVDAx");

    // Vault hook for on-chain data and transactions
    const {
        vaultData,
        loading: vaultLoading,
        vaultState,
        userShareBalance,
        userUnderlyingBalance,
        pendingWithdrawal,
        deposit,
        requestWithdrawal,
        processWithdrawal,
        txStatus,
        txError,
        txSignature,
        refresh,
    } = useVault(ticker);

    // RFQ hook for quote fetching
    const rfq = useRfq();

    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
    const [underlyingPrice, setUnderlyingPrice] = useState<number | null>(null);
    const [priceLoading, setPriceLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchPrice = async () => {
        const feedId = PYTH_FEEDS[ticker];
        if (!feedId) return;
        setPriceLoading(true);
        try {
            const response = await fetch(`${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`);
            const data = await response.json();
            if (data.parsed?.[0]) {
                const priceData = data.parsed[0].price;
                setUnderlyingPrice(parseFloat(priceData.price) * Math.pow(10, priceData.expo));
                setLastUpdated(new Date());
            }
        } catch (e) { console.error(e); }
        setPriceLoading(false);
    };

    useEffect(() => {
        fetchPrice();
        const interval = setInterval(fetchPrice, 15000);
        return () => clearInterval(interval);
    }, [ticker]);

    // Format helpers
    const decimals = vaultMeta?.decimals || 6;
    const formatTokenAmount = (amount: number) => (amount / Math.pow(10, decimals)).toFixed(2);
    // Calculate strike price: ~10% OTM, rounded to $2.50 increments
    const getRealisticStrike = (spot: number): number => {
        // Calculate 10% OTM target
        const otmTarget = spot * 1.10;
        // Round to nearest $2.50 increment
        const increment = 2.5;
        return Math.round(otmTarget / increment) * increment;
    };
    const strikePrice = underlyingPrice ? getRealisticStrike(underlyingPrice) : null;
    const formatPrice = (p: number | null) => p ? `$${p.toFixed(2)}` : "—";
    const depositNum = parseFloat(depositAmount) || 0;
    const withdrawNum = parseFloat(withdrawAmount) || 0;
    const estPremiumUsd = underlyingPrice && depositNum ? (depositNum * underlyingPrice * vaultMeta.premiumRange[0] / 100) : null;

    // Handle deposit
    const handleDeposit = async () => {
        if (!depositNum || depositNum <= 0) return;
        try {
            const amountInBaseUnits = Math.floor(depositNum * Math.pow(10, decimals));
            await deposit(amountInBaseUnits);
            setDepositAmount("");
        } catch (err) {
            console.error("Deposit failed:", err);
        }
    };

    // Handle withdrawal request
    const handleRequestWithdrawal = async () => {
        if (!withdrawNum || withdrawNum <= 0) return;
        try {
            const sharesInBaseUnits = Math.floor(withdrawNum * Math.pow(10, decimals));
            await requestWithdrawal(sharesInBaseUnits);
            setWithdrawAmount("");
        } catch (err) {
            console.error("Withdrawal request failed:", err);
        }
    };

    // Handle process withdrawal
    const handleProcessWithdrawal = async () => {
        try {
            await processWithdrawal();
        } catch (err) {
            console.error("Process withdrawal failed:", err);
        }
    };

    // Set max amount
    // Set max amount
    const handleHalfDeposit = () => {
        setDepositAmount(formatTokenAmount(userUnderlyingBalance / 2));
    };

    const handleMaxDeposit = () => {
        setDepositAmount(formatTokenAmount(userUnderlyingBalance));
    };

    const handleMaxWithdraw = () => {
        setWithdrawAmount(formatTokenAmount(userShareBalance));
    };

    // Transaction status display
    const getTxButtonText = (defaultText: string) => {
        switch (txStatus) {
            case "building": return "Building...";
            case "signing": return "Sign in wallet...";
            case "confirming": return "Confirming...";
            default: return defaultText;
        }
    };

    const isProcessing = txStatus === "building" || txStatus === "signing" || txStatus === "confirming";

    if (!vaultMeta) {
        return (
            <div className="max-w-4xl mx-auto text-center py-20">
                <h1 className="text-3xl font-bold text-foreground mb-4">Vault not found</h1>
                <Link href="/v2" className="text-blue-400 text-lg">← Back to Earn</Link>
            </div>
        );
    }

    // Use on-chain data if available, fallback to metadata
    const tvlTokens = vaultData?.tvl || 0;
    const tvlUsd = tvlTokens * (underlyingPrice || 0); // TVL in USD
    const epoch = vaultData?.epoch || 0;
    const utilization = vaultData ?
        (Number(vaultData.totalShares) > 0 ? (vaultData.utilizationCapBps / 100) : 0) : 0;

    // Epoch timing - calculate based on a fixed weekly schedule
    // Epochs run Sunday 00:00 UTC to Saturday 23:59 UTC
    const getEpochEndTime = () => {
        const now = new Date();
        // Find next Saturday 23:59 UTC
        const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
        const nextSaturday = new Date(now);
        nextSaturday.setUTCDate(now.getUTCDate() + daysUntilSaturday);
        nextSaturday.setUTCHours(23, 59, 59, 999);
        return Math.floor(nextSaturday.getTime() / 1000);
    };

    const [timeUntilEpochEnd, setTimeUntilEpochEnd] = useState(0);

    useEffect(() => {
        const updateTime = () => {
            const epochEnd = getEpochEndTime();
            const remaining = Math.max(0, epochEnd - Math.floor(Date.now() / 1000));
            setTimeUntilEpochEnd(remaining);
        };
        updateTime();
        const interval = setInterval(updateTime, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const hoursUntilEnd = Math.floor(timeUntilEpochEnd / 3600);
    const daysUntilEnd = Math.floor(hoursUntilEnd / 24);
    const remainingHours = hoursUntilEnd % 24;

    // Themed background gradient
    const backgroundStyle = {
        background: `linear-gradient(135deg, #0B0F17 0%, ${theme.accentSoft} 50%, #0B0F17 100%)`,
        backgroundSize: '200% 200%',
    };

    return (
        <div className="space-y-4 min-h-screen -m-4 p-4" style={{ ...backgroundStyle, width: 'calc(100% + 2rem)' }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <Link href="/v2" className="hover:text-gray-200">Earn</Link>
                <span>/</span>
                <span className="text-gray-200">{vaultMeta.name}</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white">{vaultMeta.name}</h1>
                        {vaultMeta.isLive && (
                            <span
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                                style={{
                                    backgroundColor: theme.accentSoft,
                                    color: theme.accent,
                                    borderColor: theme.accentBorder
                                }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.accent }} />Live
                            </span>
                        )}
                        {vaultLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{vaultMeta.strategy} · {vaultMeta.tier}</p>
                </div>
                <div className="text-right group relative">
                    <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        Est. APY (7 epochs) <Info className="w-3 h-3 text-gray-500" />
                    </p>
                    <p className="text-3xl font-bold text-green-400">{vaultData?.apy || vaultMeta.apy}%</p>
                </div>
            </div>

            {/* Epoch Chips */}
            <div className="flex items-center gap-2">
                {[
                    { label: "Strike", value: `${Math.round(vaultMeta.strikeOffset * 100)}% OTM` },
                    { label: "Roll", value: "~5h" },
                    { label: "Premium", value: `${vaultMeta.premiumRange[0]}-${vaultMeta.premiumRange[1]}%`, highlight: true },
                    { label: "Cap", value: `+${Math.round(vaultMeta.strikeOffset * 100)}%`, warn: true },
                ].map((chip, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 h-10 rounded-full bg-gray-800/50 border border-gray-700/50 text-sm">
                        <span className="text-gray-400">{chip.label}</span>
                        <span className={`font-semibold ${chip.highlight ? 'text-green-400' : chip.warn ? 'text-yellow-400' : 'text-white'}`}>{chip.value}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-4">
                    {/* KPI Row */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                                TVL
                                <span className="relative group">
                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        Total Value Locked - Assets deposited in this vault
                                    </span>
                                </span>
                            </p>
                            <p className="text-2xl font-bold text-white">${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-blue-400 mt-0.5">{tvlTokens.toFixed(2)} {vaultMeta.symbol}</p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                                Epoch
                                <span className="relative group">
                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        Current epoch - Each epoch is one options cycle (~7 days)
                                    </span>
                                </span>
                            </p>
                            <p className="text-2xl font-bold text-white">#{epoch}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {daysUntilEnd > 0 ? `${daysUntilEnd}d ${remainingHours}h left` : `${hoursUntilEnd}h left`}
                            </p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                                Utilization
                                <span className="relative group">
                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        % of vault assets deployed in options positions
                                    </span>
                                </span>
                            </p>
                            <p className="text-2xl font-bold text-white">{utilization}%</p>
                            <p className="text-xs text-gray-500 mt-0.5">of {vaultData?.utilizationCapBps ? vaultData.utilizationCapBps / 100 : 60}%</p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                                Est. Premium
                                <span className="relative group">
                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        Estimated yield from selling covered calls
                                    </span>
                                </span>
                            </p>
                            <p className="text-2xl font-bold text-green-400">{vaultMeta.premiumRange[0]}-{vaultMeta.premiumRange[1]}%</p>
                            <p className="text-xs text-gray-500 mt-0.5">this roll</p>
                        </div>
                    </div>

                    {/* Vault Status */}
                    <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Status</h3>
                            {lastUpdated && (
                                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                    {priceLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        {/* Status Chips */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800/60 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-gray-200">Oracle OK</span>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${rfq.routerOnline ? 'bg-gray-900/60 border-gray-800/60' : 'bg-red-500/10 border-red-500/30'}`}>
                                {rfq.routerLoading ? (
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                ) : rfq.routerOnline ? (
                                    <Radio className="w-4 h-4 text-green-500" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className={rfq.routerOnline ? 'text-gray-200' : 'text-red-400'}>
                                    {rfq.routerLoading ? 'Checking...' : rfq.routerOnline ? 'RFQ Online' : 'RFQ Offline'}
                                </span>
                            </div>
                            {rfq.rfqStatus !== 'IDLE' && rfq.rfqStatus !== 'ERROR' && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
                                    {rfq.rfqStatus === 'OPEN' ? (
                                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                    ) : rfq.rfqStatus === 'FILLED' ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <Clock className="w-4 h-4 text-yellow-400" />
                                    )}
                                    <span className="text-blue-400">
                                        {rfq.rfqStatus === 'OPEN' ? `${rfq.quoteCount} quotes` : rfq.rfqStatus}
                                    </span>
                                    {rfq.bestPremium && (
                                        <span className="text-green-400 font-semibold ml-1">
                                            +${(rfq.bestPremium / 1e6).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="px-2 py-1 rounded bg-gray-900/60 text-xs text-gray-500">Pyth</div>
                        </div>

                        {/* Price Chips */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/40 text-sm">
                                <span className="text-gray-400">Spot</span>
                                <span className="text-white font-semibold text-base">{formatPrice(underlyingPrice)}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/40 text-sm">
                                <span className="text-gray-400">Strike</span>
                                <span className="text-white font-semibold text-base">{formatPrice(strikePrice)}</span>
                            </div>
                        </div>

                        {/* Position Bar */}
                        <div className="p-3 rounded-lg bg-gray-900/40 border border-gray-800/40 mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-400">Position</span>
                                <span className="text-sm text-gray-300">Sold <span className="text-white font-semibold">0</span> / Target {vaultData?.utilizationCapBps ? vaultData.utilizationCapBps / 100 : 60}%</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden flex">
                                <div className="h-full w-0 rounded-full" style={{ backgroundColor: theme.accent }} />
                                <div className="h-full w-[60%] border-r-2 border-dashed border-gray-500" />
                            </div>
                        </div>

                        {/* Risk Note */}
                        {strikePrice && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400/90">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                Upside capped above {formatPrice(strikePrice)}
                            </div>
                        )}

                        {/* RFQ Section */}
                        <div className="mt-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800/40">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-400">Request Quote</span>
                                <span className="text-xs text-gray-500">Test RFQ Integration</span>
                            </div>

                            {rfq.routerOnline ? (
                                <button
                                    onClick={() => rfq.requestQuote({
                                        underlying: vaultMeta.symbol,
                                        spotPrice: underlyingPrice || 100,
                                        strikeOffsetPct: vaultMeta.strikeOffset,
                                        notionalAmount: 1000 * 1e6, // $1000 notional
                                        epochDurationHours: 168, // 7 days
                                    })}
                                    disabled={rfq.rfqLoading || rfq.rfqStatus === 'OPEN'}
                                    className="w-full py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                    style={{
                                        backgroundColor: rfq.rfqLoading || rfq.rfqStatus === 'OPEN' ? '#374151' : theme.accentSoft,
                                        color: theme.accent,
                                        borderWidth: '1px',
                                        borderColor: theme.accentBorder,
                                    }}
                                >
                                    {rfq.rfqLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Requesting...
                                        </span>
                                    ) : rfq.rfqStatus === 'OPEN' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Radio className="w-4 h-4 animate-pulse" />
                                            Collecting {rfq.quoteCount} quotes...
                                        </span>
                                    ) : (
                                        'Request Quote from Market Makers'
                                    )}
                                </button>
                            ) : (
                                <p className="text-xs text-gray-500 text-center py-2">
                                    RFQ Router offline - Start with: <code className="bg-gray-800 px-1 rounded">npm run dev</code> in rfq-router
                                </p>
                            )}

                            {/* Quote Result */}
                            {rfq.bestPremium && rfq.rfqStatus === 'FILLED' && (
                                <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-green-400">Best Quote Accepted</span>
                                        <span className="text-green-400 font-semibold">
                                            +${(rfq.bestPremium / 1e6).toFixed(4)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        From: {rfq.bestMaker?.slice(0, 8)}...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payoff Chart */}
                    {underlyingPrice && strikePrice && (
                        <PayoffChart spotPrice={underlyingPrice} strikePrice={strikePrice} premiumRange={vaultMeta.premiumRange} />
                    )}

                    {/* Vault State Banner - Manual Epoch Mode */}
                    {vaultMeta.isLive && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${vaultState === "ACTIVE"
                            ? "bg-green-500/10 border border-green-500/20"
                            : "bg-blue-500/10 border border-blue-500/20"
                            }`}>
                            {vaultState === "ACTIVE" ? (
                                <>
                                    <Play className="w-4 h-4 text-green-400" />
                                    <span className="text-green-300">
                                        <strong>Exposure Active</strong> — Epoch #{epoch} · Withdrawals queued until settlement
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-4 h-4 text-blue-400" />
                                    <span className="text-blue-300">
                                        {tvlTokens > 0
                                            ? <><strong>Awaiting Manual Roll</strong> — Epoch #{epoch} · Ready for execution</>
                                            : `Live on Devnet. Deposit to start Epoch #${epoch}.`
                                        }
                                    </span>
                                </>
                            )}
                        </div>
                    )}


                    {/* Transaction Status Toast */}
                    {txSignature && txStatus === "success" && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-green-300">Transaction confirmed!</span>
                            <a
                                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-green-400 hover:text-green-300 flex items-center gap-1"
                            >
                                View <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    )}

                    {txError && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-red-300">{txError}</span>
                        </div>
                    )}
                </div>

                {/* Deposit Panel */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4 sticky top-4">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-400">{vaultMeta.strategy} ({vaultMeta.tier})</span>
                            <button onClick={refresh} className="text-gray-500 hover:text-gray-300">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 mb-4 p-1 bg-gray-900/60 rounded-lg">
                            <button
                                onClick={() => setActiveTab("deposit")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "deposit" ? "text-white" : "text-gray-400 hover:text-white"}`}
                                style={activeTab === "deposit" ? { backgroundColor: theme.accent } : {}}
                            >Deposit</button>
                            <button
                                onClick={() => setActiveTab("withdraw")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "withdraw" ? "text-white" : "text-gray-400 hover:text-white"}`}
                                style={activeTab === "withdraw" ? { backgroundColor: theme.accent } : {}}
                            >Withdraw</button>
                        </div>

                        {activeTab === "deposit" ? (
                            <div className="space-y-4">
                                {/* User balance */}
                                {/* User balance moved inside input */}

                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                                    <div className="flex">
                                        {/* Left: Token Pill */}
                                        <div className="flex items-center pr-4 border-r border-gray-800/60">
                                            <div className="flex items-center gap-2 bg-gray-800 rounded-full pl-1.5 pr-3 py-1.5">
                                                <img
                                                    src={vaultMeta.logo}
                                                    alt={vaultMeta.symbol}
                                                    className="w-7 h-7 rounded-full object-cover"
                                                />
                                                <span className="font-semibold text-white text-sm">{vaultMeta.symbol}</span>
                                            </div>
                                        </div>

                                        {/* Right: Balance/Buttons + Amount + USD */}
                                        <div className="flex-1 pl-4 flex flex-col">
                                            {/* Top row: Balance + HALF/MAX */}
                                            <div className="flex items-center justify-end gap-2 mb-2">
                                                {connected && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer hover:text-gray-400" onClick={() => setDepositAmount(formatTokenAmount(userUnderlyingBalance))}>
                                                        <Wallet className="w-3 h-3" />
                                                        <span>{formatTokenAmount(userUnderlyingBalance)} {vaultMeta.symbol}</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setDepositAmount(formatTokenAmount(userUnderlyingBalance / 2))}
                                                    disabled={isProcessing || !connected}
                                                    className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                                                    style={{ color: theme.accent }}
                                                >
                                                    HALF
                                                </button>
                                                <button
                                                    onClick={handleMaxDeposit}
                                                    disabled={isProcessing || !connected}
                                                    className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                                                    style={{ color: theme.accent }}
                                                >
                                                    MAX
                                                </button>
                                            </div>

                                            {/* Big amount input */}
                                            <input
                                                type="number"
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(e.target.value)}
                                                placeholder="0.00"
                                                disabled={isProcessing}
                                                className="w-full text-right text-3xl font-semibold bg-transparent border-none outline-none p-0 placeholder-gray-600 text-white appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />

                                            {/* USD value */}
                                            <span className="text-[11px] text-gray-500 text-right mt-0.5">
                                                ≈ ${underlyingPrice ? (Number(depositAmount || 0) * underlyingPrice).toFixed(2) : "0.00"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Outcome Table */}
                                <div className="rounded-lg bg-gray-900/40 border border-gray-800/60 divide-y divide-gray-800/60">
                                    <div className="flex justify-between px-4 py-3">
                                        <span className="text-sm text-gray-400">You deposit</span>
                                        <span className="text-white font-semibold">{depositNum.toFixed(2)} {vaultMeta.symbol}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-3">
                                        <span className="text-sm text-gray-400">You receive</span>
                                        <span className="text-white font-semibold">{depositNum.toFixed(2)} v{vaultMeta.symbol}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-3">
                                        <span className="text-sm text-gray-400">Withdraw</span>
                                        <span className="text-gray-300">Epoch end (~5h)</span>
                                    </div>
                                    {estPremiumUsd && estPremiumUsd > 0 && (
                                        <div className="flex justify-between px-4 py-3">
                                            <span className="text-sm text-gray-400">Est. premium</span>
                                            <span className="text-green-400 font-semibold">~${estPremiumUsd.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Summary line */}
                                {strikePrice && (
                                    <p className="text-sm text-gray-400 text-center">
                                        Withdraw unlocks at epoch end. Upside capped above {formatPrice(strikePrice)}.
                                    </p>
                                )}

                                {connected ? (
                                    <button
                                        onClick={handleDeposit}
                                        disabled={isProcessing || depositNum <= 0}
                                        className="w-full py-3 h-12 rounded-lg hover:brightness-110 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium transition-all flex items-center justify-center gap-2"
                                        style={{ backgroundColor: isProcessing || depositNum <= 0 ? undefined : theme.accent }}
                                    >
                                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {getTxButtonText("Deposit")}
                                    </button>
                                ) : (
                                    <button className="w-full py-3 h-12 rounded-lg bg-gray-700 text-gray-400 font-medium cursor-not-allowed">
                                        Connect Wallet
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* User share balance */}
                                <div className="p-4 rounded-lg bg-gray-900/40 border border-gray-800/60 text-center">
                                    <p className="text-sm text-gray-400">Your shares</p>
                                    <p className="text-3xl font-bold text-white mt-1">{formatTokenAmount(userShareBalance)}</p>
                                    <p className="text-sm text-gray-500 mt-0.5">v{vaultMeta.symbol}</p>
                                </div>

                                {/* Pending withdrawal */}
                                {pendingWithdrawal && !pendingWithdrawal.processed && (
                                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400/90">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4" />
                                            Pending withdrawal: {formatTokenAmount(pendingWithdrawal.shares)} shares
                                        </div>
                                        <p className="text-xs text-yellow-500/70">Requested in epoch #{pendingWithdrawal.requestEpoch}</p>
                                        {vaultData && vaultData.epoch > pendingWithdrawal.requestEpoch && (
                                            <button
                                                onClick={handleProcessWithdrawal}
                                                disabled={isProcessing}
                                                className="mt-2 w-full py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-black font-medium text-sm flex items-center justify-center gap-2"
                                            >
                                                {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                                                Claim Withdrawal
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Request new withdrawal */}
                                {(!pendingWithdrawal || pendingWithdrawal.processed) && userShareBalance > 0 && (
                                    <>
                                        <div>
                                            <label className="text-sm text-gray-400 mb-2 block">Shares to withdraw</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={withdrawAmount}
                                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    disabled={isProcessing}
                                                    className="w-full px-4 py-3 h-12 rounded-lg bg-gray-900/60 border border-gray-700/60 text-white text-lg placeholder-gray-600 focus:outline-none focus:border-blue-500/60 disabled:opacity-50 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    <span className="text-sm text-gray-500">v{vaultMeta.symbol}</span>
                                                    <button
                                                        onClick={handleMaxWithdraw}
                                                        disabled={isProcessing}
                                                        className="text-xs font-medium hover:brightness-125 disabled:opacity-50"
                                                        style={{ color: theme.accent }}
                                                    >
                                                        MAX
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400/90 flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Processed at epoch end
                                        </div>

                                        <button
                                            onClick={handleRequestWithdrawal}
                                            disabled={isProcessing || withdrawNum <= 0}
                                            className="w-full py-3 h-12 rounded-lg hover:brightness-110 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium transition-all flex items-center justify-center gap-2"
                                            style={{ backgroundColor: isProcessing || withdrawNum <= 0 ? undefined : theme.accent }}
                                        >
                                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {getTxButtonText("Request Withdrawal")}
                                        </button>
                                    </>
                                )}

                                {userShareBalance === 0 && (!pendingWithdrawal || pendingWithdrawal.processed) && (
                                    <>
                                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400/90 flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Processed at epoch end
                                        </div>
                                        <button className="w-full py-3 h-12 rounded-lg bg-gray-700 text-gray-400 font-medium cursor-not-allowed">
                                            No shares
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
