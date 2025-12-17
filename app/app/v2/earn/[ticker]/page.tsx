"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { RefreshCw, Info, CheckCircle, Clock, AlertCircle, Zap } from "lucide-react";

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
}> = {
    nvdax: { name: "NVDAx Vault", symbol: "NVDAx", strategy: "Covered Call", tier: "Normal", strikeOffset: 0.10, apy: 12.4, isLive: true, premiumRange: [0.8, 1.2] },
    aaplx: { name: "AAPLx Vault", symbol: "AAPLx", strategy: "Covered Call", tier: "Conservative", strikeOffset: 0.05, apy: 8.2, isLive: false, premiumRange: [0.4, 0.7] },
    tslax: { name: "TSLAx Vault", symbol: "TSLAx", strategy: "Covered Call", tier: "Aggressive", strikeOffset: 0.08, apy: 18.6, isLive: false, premiumRange: [1.2, 2.0] },
    spyx: { name: "SPYx Vault", symbol: "SPYx", strategy: "Covered Call", tier: "Conservative", strikeOffset: 0.05, apy: 6.5, isLive: false, premiumRange: [0.3, 0.5] },
    metax: { name: "METAx Vault", symbol: "METAx", strategy: "Covered Call", tier: "Normal", strikeOffset: 0.10, apy: 15.2, isLive: false, premiumRange: [1.0, 1.5] },
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
    const vault = VAULT_METADATA[ticker];
    const { connected } = useWallet();
    const [depositAmount, setDepositAmount] = useState("");
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

    const strikePrice = underlyingPrice ? underlyingPrice * (1 + (vault?.strikeOffset || 0.10)) : null;
    const formatPrice = (p: number | null) => p ? `$${p.toFixed(2)}` : "—";
    const depositNum = parseFloat(depositAmount) || 0;
    const estPremiumUsd = underlyingPrice && depositNum ? (depositNum * underlyingPrice * vault.premiumRange[0] / 100) : null;

    if (!vault) {
        return (
            <div className="max-w-4xl mx-auto text-center py-20">
                <h1 className="text-3xl font-bold text-foreground mb-4">Vault not found</h1>
                <Link href="/v2" className="text-blue-400 text-lg">← Back to Earn</Link>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <Link href="/v2" className="hover:text-gray-200">Earn</Link>
                <span>/</span>
                <span className="text-gray-200">{vault.name}</span>
            </div>

            {/* Header - Larger */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white">{vault.name}</h1>
                        {vault.isLive && (
                            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{vault.strategy} · {vault.tier}</p>
                </div>
                <div className="text-right group relative">
                    <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        Est. APY (7 epochs) <Info className="w-3 h-3 text-gray-500" />
                    </p>
                    <p className="text-3xl font-bold text-green-400">{vault.apy}%</p>
                    <div className="absolute right-0 top-full mt-2 w-44 p-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        Based on last 7 epochs, annualized
                    </div>
                </div>
            </div>

            {/* Epoch Chips - Taller */}
            <div className="flex items-center gap-2">
                {[
                    { label: "Strike", value: `${Math.round(vault.strikeOffset * 100)}% OTM` },
                    { label: "Roll", value: "~5h" },
                    { label: "Premium", value: `${vault.premiumRange[0]}-${vault.premiumRange[1]}%`, highlight: true },
                    { label: "Cap", value: `+${Math.round(vault.strikeOffset * 100)}%`, warn: true },
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
                    {/* KPI Row - Larger */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1">TVL</p>
                            <p className="text-2xl font-bold text-white">$0</p>
                            <p className="text-xs text-blue-400 mt-0.5">Devnet</p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1">Epoch</p>
                            <p className="text-2xl font-bold text-white">#0</p>
                            <p className="text-xs text-gray-500 mt-0.5">bootstrap</p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1">Utilization</p>
                            <p className="text-2xl font-bold text-white">0%</p>
                            <p className="text-xs text-gray-500 mt-0.5">of 60%</p>
                        </div>
                        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4">
                            <p className="text-sm text-gray-400 mb-1">Est. Premium</p>
                            <p className="text-2xl font-bold text-green-400">{vault.premiumRange[0]}-{vault.premiumRange[1]}%</p>
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
                                <span className="text-gray-200">Healthy</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800/60 text-sm">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-200">RFQ Idle</span>
                            </div>
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
                                <span className="text-sm text-gray-300">Sold <span className="text-white font-semibold">0</span> / Target 60%</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-gray-800 overflow-hidden flex">
                                <div className="h-full w-0 bg-blue-500 rounded-full" />
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
                    </div>

                    {/* Payoff Chart */}
                    {underlyingPrice && strikePrice && (
                        <PayoffChart spotPrice={underlyingPrice} strikePrice={strikePrice} premiumRange={vault.premiumRange} />
                    )}

                    {/* Devnet Info */}
                    {vault.isLive && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <span className="text-blue-300">Live on Devnet. Deposit to start Epoch #0.</span>
                        </div>
                    )}

                    {/* How it Works */}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        {["Deposit", "Vault sells calls", "Earn", "Withdraw"].map((step, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-xs">{i + 1}</span>
                                <span>{step}</span>
                                {i < 3 && <span className="text-gray-600 ml-2">→</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deposit Panel */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4 sticky top-4">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-400">{vault.strategy} ({vault.tier})</span>
                        </div>

                        {/* Tabs - Taller */}
                        <div className="flex gap-1 mb-4 p-1 bg-gray-900/60 rounded-lg">
                            <button
                                onClick={() => setActiveTab("deposit")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "deposit" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"}`}
                            >Deposit</button>
                            <button
                                onClick={() => setActiveTab("withdraw")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "withdraw" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"}`}
                            >Withdraw</button>
                        </div>

                        {activeTab === "deposit" ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Amount</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-4 py-3 h-12 rounded-lg bg-gray-900/60 border border-gray-700/60 text-white text-lg placeholder-gray-600 focus:outline-none focus:border-blue-500/60"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <span className="text-sm text-gray-500">{vault.symbol}</span>
                                            <button className="text-xs text-blue-400 font-medium hover:text-blue-300">MAX</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Outcome Table - Larger values */}
                                <div className="rounded-lg bg-gray-900/40 border border-gray-800/60 divide-y divide-gray-800/60">
                                    <div className="flex justify-between px-4 py-3">
                                        <span className="text-sm text-gray-400">You deposit</span>
                                        <span className="text-white font-semibold">{depositNum.toFixed(2)} {vault.symbol}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-3">
                                        <span className="text-sm text-gray-400">You receive</span>
                                        <span className="text-white font-semibold">{depositNum.toFixed(2)} v{vault.symbol}</span>
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
                                    <button className="w-full py-3 h-12 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">
                                        Deposit
                                    </button>
                                ) : (
                                    <button className="w-full py-3 h-12 rounded-lg bg-gray-700 text-gray-400 font-medium cursor-not-allowed">
                                        Connect Wallet
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-gray-900/40 border border-gray-800/60 text-center">
                                    <p className="text-sm text-gray-400">Your shares</p>
                                    <p className="text-3xl font-bold text-white mt-1">0.00</p>
                                    <p className="text-sm text-gray-500 mt-0.5">v{vault.symbol}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400/90 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Processed at epoch end
                                </div>
                                <button className="w-full py-3 h-12 rounded-lg bg-gray-700 text-gray-400 font-medium cursor-not-allowed">
                                    No shares
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
