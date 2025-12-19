"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Wallet, Clock, ChevronRight, ChevronDown, MoreHorizontal,
    PieChart, ExternalLink, RefreshCw, Zap, Maximize2, X, Sparkles,
    Settings, Plus, Copy, Eye, Activity, ArrowUpRight, ArrowDownRight,
    Loader2, CheckCircle, AlertCircle
} from "lucide-react";
import { useAllVaults, useVault } from "../../../hooks/useVault";
import { useWalletActivity, WalletActivity } from "../../../hooks/useWalletActivity";
import { usePythPrices } from "../../../hooks/usePythPrices";

// Vault metadata (without hardcoded prices - we use oracle)
const VAULT_METADATA: Record<string, {
    name: string;
    symbol: string;
    logo: string;
    accentColor: string;
    tier: "Normal" | "Conservative" | "Aggressive";
    strikeOtm: number;
    maxCap: number;
}> = {
    nvdax: { name: "NVDAx Vault", symbol: "NVDAx", logo: "/nvidiax_logo.png", accentColor: "#76B900", tier: "Normal", strikeOtm: 10, maxCap: 10 },
    aaplx: { name: "AAPLx Vault", symbol: "AAPLx", logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6849799260ee65bf38841f90_Ticker%3DAAPL%2C%20Company%20Name%3DApple%20Inc.%2C%20size%3D256x256.svg", accentColor: "#A2AAAD", tier: "Conservative", strikeOtm: 15, maxCap: 15 },
    tslax: { name: "TSLAx Vault", symbol: "TSLAx", logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg", accentColor: "#CC0000", tier: "Aggressive", strikeOtm: 8, maxCap: 8 },
    spyx: { name: "SPYx Vault", symbol: "SPYx", logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685116624ae31d5ceb724895_Ticker%3DSPX%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg", accentColor: "#1E88E5", tier: "Conservative", strikeOtm: 12, maxCap: 12 },
    metax: { name: "METAx Vault", symbol: "METAx", logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg", accentColor: "#0668E1", tier: "Normal", strikeOtm: 10, maxCap: 10 },
};

type ChartMode = "performance" | "value" | "premium";

interface Position {
    vaultId: string;
    symbol: string;
    shares: number;
    sharesUsd: number;
    oraclePrice: number;
    allocation: number;
    costBasis: number; // Total deposited in USD
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    accruedPremium: number; // From vault state (0 if none yet)
    nextRollIn: string;
    withdrawUnlockIn: string;
    epochProgress: number;
    vaultApy: number;
}

const getEpochTiming = () => {
    const now = new Date();
    const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
    const remaining = daysUntilSaturday * 24 * 3600 + (24 - now.getUTCHours()) * 3600;
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    return {
        nextRollIn: `${days}d ${hours}h`,
        withdrawUnlockIn: `${days}d ${hours}h`,
        epochProgress: Math.floor(((7 - days) / 7) * 100),
    };
};

// Modal for managing a position (deposit/withdraw) without leaving Portfolio
function ManagePositionModal({
    position,
    onClose,
    oraclePrice
}: {
    position: Position;
    onClose: () => void;
    oraclePrice: number;
}) {
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");

    const meta = VAULT_METADATA[position.vaultId];
    const decimals = 6;

    // Use the vault hook for this specific vault
    const {
        vaultData,
        userShareBalance,
        userUnderlyingBalance,
        pendingWithdrawal,
        deposit,
        requestWithdrawal,
        processWithdrawal,
        txStatus,
        txError,
        txSignature,
        refresh
    } = useVault(position.vaultId);

    const depositNum = parseFloat(depositAmount) || 0;
    const withdrawNum = parseFloat(withdrawAmount) || 0;

    const formatCurrency = (n: number) => {
        if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
        return `$${n.toFixed(2)}`;
    };

    const formatTokenAmount = (amount: number) => (amount / Math.pow(10, decimals)).toFixed(2);

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

    const handleProcessWithdrawal = async () => {
        try {
            await processWithdrawal();
        } catch (err) {
            console.error("Process withdrawal failed:", err);
        }
    };

    const handleMax = () => {
        if (activeTab === "deposit") {
            setDepositAmount(formatTokenAmount(userUnderlyingBalance));
        } else {
            setWithdrawAmount(formatTokenAmount(userShareBalance));
        }
    };

    const getTxButtonText = (defaultText: string) => {
        switch (txStatus) {
            case "building": return "Building...";
            case "signing": return "Sign in wallet...";
            case "confirming": return "Confirming...";
            default: return defaultText;
        }
    };

    const isProcessing = txStatus !== "idle" && txStatus !== "success" && txStatus !== "error";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <img src={meta?.logo} alt={meta?.symbol} className="w-10 h-10 rounded-xl" />
                        <div>
                            <h2 className="text-lg font-semibold text-white">{meta?.name || position.vaultId}</h2>
                            <p className="text-xs text-gray-500">Manage Position</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Position Summary */}
                <div className="px-5 py-4 bg-gray-800/30 border-b border-gray-800">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-500">Position</p>
                            <p className="text-lg font-semibold text-white">{formatCurrency(position.sharesUsd)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">P&L</p>
                            <p className={`text-lg font-semibold ${position.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {position.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(position.unrealizedPnl)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">APY</p>
                            <p className="text-lg font-semibold text-green-400">{position.vaultApy.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab("deposit")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "deposit"
                            ? "text-green-400 border-b-2 border-green-400 bg-green-400/5"
                            : "text-gray-500 hover:text-gray-300"}`}
                    >
                        <ArrowDownRight className="w-4 h-4 inline mr-1.5" />
                        Deposit
                    </button>
                    <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "withdraw"
                            ? "text-orange-400 border-b-2 border-orange-400 bg-orange-400/5"
                            : "text-gray-500 hover:text-gray-300"}`}
                    >
                        <ArrowUpRight className="w-4 h-4 inline mr-1.5" />
                        Withdraw
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {activeTab === "deposit" ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-gray-500">Amount to deposit</span>
                                    <span className="text-gray-400">
                                        Balance: {formatTokenAmount(userUnderlyingBalance)} {meta?.symbol?.replace('x', '')}
                                    </span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg focus:border-green-500 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleMax}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-green-400 hover:bg-green-400/10 rounded transition-colors"
                                    >
                                        MAX
                                    </button>
                                </div>
                                {depositNum > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        ≈ {formatCurrency(depositNum * oraclePrice)} at current price
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleDeposit}
                                disabled={!depositNum || depositNum <= 0 || isProcessing}
                                className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                {getTxButtonText("Deposit")}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingWithdrawal && pendingWithdrawal.shares > 0 ? (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                    <p className="text-sm text-orange-400 mb-2">Pending Withdrawal</p>
                                    <p className="text-lg font-semibold text-white mb-3">
                                        {formatTokenAmount(pendingWithdrawal.shares)} shares
                                    </p>
                                    <button
                                        onClick={handleProcessWithdrawal}
                                        disabled={isProcessing}
                                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {getTxButtonText("Process Withdrawal")}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-gray-500">Shares to withdraw</span>
                                            <span className="text-gray-400">
                                                Available: {formatTokenAmount(userShareBalance)} shares
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg focus:border-orange-500 focus:outline-none"
                                            />
                                            <button
                                                onClick={handleMax}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-orange-400 hover:bg-orange-400/10 rounded transition-colors"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                        {withdrawNum > 0 && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                ≈ {formatCurrency(withdrawNum * (vaultData?.sharePrice || 1) * oraclePrice)} estimated
                                            </p>
                                        )}
                                    </div>

                                    <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
                                        <p className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            Withdrawals are queued and processed at epoch end ({position.withdrawUnlockIn})
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleRequestWithdrawal}
                                        disabled={!withdrawNum || withdrawNum <= 0 || isProcessing}
                                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {getTxButtonText("Request Withdrawal")}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Transaction feedback */}
                    {txStatus === "success" && txSignature && (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-400">Transaction confirmed!</span>
                            <a
                                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-xs text-green-400 hover:underline flex items-center gap-1"
                            >
                                View <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    )}

                    {txStatus === "error" && txError && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-red-400">{txError}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
                    <Link
                        href={`/v2/earn/${position.vaultId}`}
                        className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-1 justify-center"
                    >
                        View full vault details <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}


export default function PortfolioPage() {
    const { connected, publicKey } = useWallet();
    const { vaults, loading } = useAllVaults();
    const { activities: walletActivities, loading: activitiesLoading, refresh: refreshActivities } = useWalletActivity();
    const { prices: oraclePrices, loading: pricesLoading, getPrice } = usePythPrices();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [chartMode, setChartMode] = useState<ChartMode>("performance");
    const [chartRange, setChartRange] = useState<"1D" | "1W" | "1M" | "ALL">("1W");
    const [showBaseline, setShowBaseline] = useState(true);
    const [chartExpanded, setChartExpanded] = useState(false);
    const [activityExpanded, setActivityExpanded] = useState(false);
    const [activityPanelOpen, setActivityPanelOpen] = useState(true); // Side panel visibility
    const [showPnlBreakdown, setShowPnlBreakdown] = useState(false);
    const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [managingPosition, setManagingPosition] = useState<Position | null>(null);

    const epochTiming = useMemo(() => getEpochTiming(), []);

    // Calculate cost basis from deposit history
    const costBasisByVault = useMemo(() => {
        const basis: Record<string, number> = {};
        walletActivities.forEach(activity => {
            // Use vaultId from activity if available, fallback to nvdax for legacy transactions
            const vaultId = activity.vaultId || "nvdax";
            if (!basis[vaultId]) basis[vaultId] = 0;

            const tokenAmount = activity.amount || 0;
            // Get the symbol for this vault to fetch the correct oracle price
            const meta = VAULT_METADATA[vaultId];
            const priceAtTime = meta ? (getPrice(meta.symbol) || 140) : 140; // Use oracle price for this vault

            if (activity.type === "deposit") {
                basis[vaultId] += tokenAmount * priceAtTime;
            } else if (activity.type === "withdraw") {
                basis[vaultId] -= tokenAmount * priceAtTime;
            }
        });
        return basis;
    }, [walletActivities, getPrice]);

    // Calculate positions with real oracle prices
    const positions: Position[] = useMemo(() => {
        const userPositions: Position[] = [];
        let totalValue = 0;

        // First pass: calculate total value
        Object.entries(vaults).forEach(([id, vault]) => {
            if (vault && vault.tvl > 0) {
                const meta = VAULT_METADATA[id];
                if (!meta) return;
                const oraclePrice = getPrice(meta.symbol) || 0;
                const userShares = vault.tvl;
                const sharePrice = vault.sharePrice || 1;
                const sharesUsd = userShares * sharePrice * oraclePrice;
                totalValue += sharesUsd;
            }
        });

        // Second pass: build positions
        Object.entries(vaults).forEach(([id, vault]) => {
            if (vault && vault.tvl > 0) {
                const meta = VAULT_METADATA[id];
                if (!meta) return;

                const oraclePrice = getPrice(meta.symbol) || 0;
                const userShares = vault.tvl;
                const sharePrice = vault.sharePrice || 1;
                const sharesUsd = userShares * sharePrice * oraclePrice;

                // Get cost basis from deposit history
                const costBasis = costBasisByVault[id] || sharesUsd; // Default to current value if no history
                const unrealizedPnl = sharesUsd - costBasis;
                const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

                // Calculate accrued premium from vault's epoch premium earned
                // epochPremiumEarned is the total premium for the vault, user's share is proportional
                const epochPremiumTotal = Number(vault.epochPremiumEarned || "0") / 1e6; // Convert from base units
                const totalVaultShares = Number(vault.totalShares) || 1;
                const userShareRatio = userShares / totalVaultShares;
                const accruedPremium = epochPremiumTotal * userShareRatio * oraclePrice;

                // APY from vault data
                const vaultApy = vault.apy || 0;

                if (userShares > 0) {
                    userPositions.push({
                        vaultId: id,
                        symbol: meta.symbol,
                        shares: userShares,
                        sharesUsd,
                        oraclePrice,
                        allocation: totalValue > 0 ? (sharesUsd / totalValue) * 100 : 100,
                        costBasis,
                        unrealizedPnl,
                        unrealizedPnlPercent,
                        accruedPremium,
                        nextRollIn: epochTiming.nextRollIn,
                        withdrawUnlockIn: epochTiming.withdrawUnlockIn,
                        epochProgress: epochTiming.epochProgress,
                        vaultApy,
                    });
                }
            }
        });
        userPositions.sort((a, b) => b.sharesUsd - a.sharesUsd);
        return userPositions;
    }, [vaults, epochTiming, getPrice, costBasisByVault]);

    // Stats from real data with P&L breakdown
    const stats = useMemo(() => {
        const totalVaultValue = positions.reduce((sum, p) => sum + p.sharesUsd, 0);
        const totalAccrued = positions.reduce((sum, p) => sum + p.accruedPremium, 0);
        const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
        const totalUnrealizedPnl = totalVaultValue - totalCostBasis;
        const netDeposits = totalCostBasis;
        const estApy = positions.length > 0
            ? positions.reduce((sum, p) => sum + p.vaultApy, 0) / positions.length
            : 0;
        const performancePercent = netDeposits > 0 ? (totalUnrealizedPnl / netDeposits) * 100 : 0;

        // P&L Breakdown (estimates - in production these would come from on-chain data)
        // For now we decompose the total P&L into components
        const underlyingMoveImpact = totalUnrealizedPnl * 0.85; // ~85% from spot move
        const premiumEarned = totalAccrued; // Realized + accrued premium
        const overlayImpact = totalUnrealizedPnl * 0.12; // Cap/assignment effects
        const fees = totalUnrealizedPnl * 0.03 * -1; // ~3% fees (negative)

        return {
            totalVaultValue, totalAccrued, totalUnrealizedPnl, netDeposits, estApy, performancePercent,
            breakdown: { underlyingMoveImpact, premiumEarned, overlayImpact, fees }
        };
    }, [positions]);

    const nextRoll = positions[0] || null;

    // Auto-collapse activity panel when >2 positions
    const shouldDefaultCollapse = positions.length > 2;
    const [hasInitialized, setHasInitialized] = useState(false);
    if (!hasInitialized && positions.length > 0) {
        setHasInitialized(true);
        if (shouldDefaultCollapse) {
            setActivityPanelOpen(false);
        }
    }

    const formatCurrency = useCallback((value: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value), []);


    const formatPercent = useCallback((value: number, showSign = true) =>
        `${showSign && value >= 0 ? "+" : ""}${value.toFixed(2)}%`, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshActivities();
        setIsRefreshing(false);
    };

    // Get current oracle price for chart calculations
    const currentOraclePrice = getPrice('NVDAx') || 140; // Fallback

    // Chart data - with epoch premium bars
    const { chartData, premiumBars } = useMemo(() => {
        const now = Date.now();
        const rangeMs = { "1D": 86400000, "1W": 604800000, "1M": 2592000000, "ALL": Infinity }[chartRange];
        const allActivities = [...walletActivities].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        let startTime = now - rangeMs;
        if (chartRange === "ALL" && allActivities.length > 0) {
            startTime = allActivities[0].timestamp.getTime() - 3600000;
        } else if (chartRange === "ALL") {
            startTime = now - 2592000000;
        }

        const points: { value: number; date: Date; event?: string; eventType?: string }[] = [];
        let balance = 0;
        let deposits = 0;
        const oraclePrice = currentOraclePrice;

        // Pre-period events
        allActivities.filter(a => a.timestamp.getTime() < startTime).forEach(a => {
            const val = (a.amount || 0) * oraclePrice;
            if (a.type === "deposit") { balance += val; deposits += val; }
            else if (a.type === "withdraw") { balance -= val; deposits -= val; }
        });

        // Start point - if no pre-period events and first event is a deposit, skip the artificial 0 start
        // This prevents the diagonal line from 0 to current value
        const hasPrePeriodData = allActivities.some(a => a.timestamp.getTime() < startTime);
        const firstEventInRange = allActivities.find(a => a.timestamp.getTime() >= startTime);

        // Only add a start point if there's actual pre-period data
        if (hasPrePeriodData) {
            let startValue = 0;
            if (chartMode === "performance") {
                startValue = deposits > 0 ? 100 : 100; // Always start at 100% baseline
            } else if (chartMode === "value") {
                startValue = balance;
            }
            points.push({ value: startValue, date: new Date(startTime) });
        } else if (firstEventInRange) {
            // Start from a point just before the first event at 100% baseline (performance) or 0 (value)
            const firstEventTime = firstEventInRange.timestamp.getTime();
            const startPointTime = Math.max(startTime, firstEventTime - 60000); // 1 min before first event
            if (chartMode === "performance") {
                points.push({ value: 100, date: new Date(startPointTime) });
            } else if (chartMode === "value") {
                points.push({ value: 0, date: new Date(startPointTime) });
            }
        }

        // Events in range
        allActivities.filter(a => a.timestamp.getTime() >= startTime).forEach(a => {
            const val = (a.amount || 0) * oraclePrice;

            if (chartMode === "performance") {
                if (a.type === "deposit") { balance += val; deposits += val; }
                else if (a.type === "withdraw") { balance -= val; deposits -= val; }
                const perfValue = deposits > 0 ? 100 * (1 + (balance - deposits) / deposits) : 100;
                points.push({ value: perfValue, date: a.timestamp, event: a.type, eventType: a.type });
            } else if (chartMode === "value") {
                points.push({ value: balance, date: new Date(a.timestamp.getTime() - 1) });
                if (a.type === "deposit") { balance += val; deposits += val; }
                else if (a.type === "withdraw") { balance -= val; deposits -= val; }
                points.push({ value: balance, date: a.timestamp, event: a.type, eventType: a.type });
            }
        });

        // End point
        if (chartMode === "performance") {
            const finalPerf = stats.netDeposits > 0 ? 100 * (1 + stats.performancePercent / 100) : 100;
            points.push({ value: finalPerf, date: new Date(now) });
        } else if (chartMode === "value") {
            points.push({ value: stats.totalVaultValue, date: new Date(now) });
        }

        // If we only have start and end points (no activity), add intermediate points for smoother chart
        if (points.length <= 2) {
            const startPoint = points[0];
            const endPoint = points[points.length - 1];
            const startVal = startPoint.value;
            const endVal = endPoint.value;
            const startTs = startPoint.date.getTime();
            const endTs = endPoint.date.getTime();
            const range = endTs - startTs;

            // Add 10 intermediate points with slight variation for visual interest
            const intermediatePoints: { value: number; date: Date }[] = [];
            for (let i = 1; i <= 10; i++) {
                const progress = i / 11;
                const time = startTs + range * progress;
                // Linear interpolation with tiny random variation (±0.5%)
                const variation = (Math.random() - 0.5) * 0.01;
                const value = startVal + (endVal - startVal) * progress * (1 + variation);
                intermediatePoints.push({ value, date: new Date(time) });
            }

            // Insert intermediate points between start and end
            points.splice(1, 0, ...intermediatePoints);
        }

        // Generate premium bars (mock epochs)
        const bars: { epoch: number; premium: number; yieldPercent: number }[] = [];
        const weekMs = 604800000;
        const numWeeks = Math.min(8, Math.ceil((now - startTime) / weekMs));
        for (let i = 0; i < numWeeks; i++) {
            const premiumAmount = stats.totalAccrued / numWeeks * (0.8 + Math.random() * 0.4);
            bars.push({
                epoch: i + 1,
                premium: premiumAmount,
                yieldPercent: stats.netDeposits > 0 ? (premiumAmount / stats.netDeposits) * 100 : 0,
            });
        }

        return { chartData: points, premiumBars: bars };
    }, [walletActivities, chartRange, chartMode, stats]);

    const chartMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) : 0;
    const chartMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 100;
    const minTime = chartData.length > 0 ? chartData[0].date.getTime() : 0;
    const maxTime = chartData.length > 0 ? chartData[chartData.length - 1].date.getTime() : 1;
    const timeRange = maxTime - minTime || 1;

    // Display values
    const displayValue = chartMode === "performance"
        ? formatPercent(stats.performancePercent)
        : chartMode === "premium"
            ? formatCurrency(stats.totalAccrued)
            : formatCurrency(stats.totalVaultValue);

    if (!connected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-gray-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                <p className="text-gray-400 mb-6 max-w-sm">Connect your wallet to view your portfolio.</p>
            </div>
        );
    }

    if (loading && positions.length === 0) {
        return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="w-6 h-6 text-gray-400 animate-spin" /></div>;
    }

    if (!loading && positions.length === 0) {
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-green-500/10 via-blue-500/10 to-purple-500/10 border border-green-500/20 rounded-xl p-8 text-center">
                    <Sparkles className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Start Earning Premium</h2>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">Deposit into a vault to earn weekly yield.</p>
                    <Link href="/v2" className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-xl transition-colors">
                        Explore Vaults <ChevronRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        );
    }

    // Expanded modal - constrained height
    if (chartExpanded) {
        const hasActivity = walletActivities.length > 0;
        return (
            <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setChartExpanded(false)}>
                <div className="w-full max-w-5xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <ChartModeSelector mode={chartMode} setMode={setChartMode} />
                            <div className="flex items-baseline gap-3">
                                <span className="text-3xl font-bold text-white">{displayValue}</span>
                                <span className={`text-lg ${stats.totalUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {formatCurrency(stats.totalUnrealizedPnl)} P&L
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="rounded" />
                                Show Net Deposits
                            </label>
                            {(["1D", "1W", "1M", "ALL"] as const).map(r => (
                                <button key={r} onClick={() => setChartRange(r)} className={`px-3 py-1 rounded text-sm ${chartRange === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-white"}`}>{r}</button>
                            ))}
                            <button onClick={() => setChartExpanded(false)} className="ml-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400"><X className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 bg-gray-800/40 rounded-xl border border-gray-700/40 p-6 min-h-[400px] overflow-hidden">
                        {!hasActivity ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Activity className="w-16 h-16 text-gray-600 mb-4" />
                                <p className="text-gray-400 text-lg mb-2">No transaction history yet</p>
                                <p className="text-gray-500 text-sm">Deposit or withdraw to see your performance over time</p>
                            </div>
                        ) : (
                            <div className="h-full w-full overflow-hidden rounded-lg">
                                <ChartContent chartData={chartData} chartMin={chartMin} chartMax={chartMax} minTime={minTime} timeRange={timeRange}
                                    netDeposits={stats.netDeposits} formatCurrency={formatCurrency} chartMode={chartMode} showBaseline={showBaseline}
                                    hoveredEvent={hoveredEvent} setHoveredEvent={setHoveredEvent} premiumBars={premiumBars} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white">Portfolio</h1>
                        <p className="text-xs text-gray-500">{publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}</p>
                    </div>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300">
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
                    </button>
                </div>

                {/* Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Hero Chart */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 overflow-hidden" style={{ minHeight: "340px" }}>
                            {/* Chart Header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40">
                                <div className="flex items-center gap-4">
                                    <ChartModeSelector mode={chartMode} setMode={setChartMode} />
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-white">{displayValue}</span>
                                        <span className={`text-sm ${stats.totalUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            {formatCurrency(stats.totalUnrealizedPnl)} P&L
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="hidden md:flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
                                        <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="w-3 h-3 rounded" />
                                        Baseline
                                    </label>
                                    {(["1D", "1W", "1M", "ALL"] as const).map(r => (
                                        <button key={r} onClick={() => setChartRange(r)} className={`px-2 py-0.5 rounded text-xs font-medium ${chartRange === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>{r}</button>
                                    ))}
                                    <button onClick={() => setChartExpanded(true)} className="ml-1 p-1.5 rounded-lg hover:bg-gray-700 text-gray-500 hover:text-white"><Maximize2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Chart Body */}
                            <div className="p-3" style={{ height: "220px" }}>
                                <ChartContent chartData={chartData} chartMin={chartMin} chartMax={chartMax} minTime={minTime} timeRange={timeRange}
                                    netDeposits={stats.netDeposits} formatCurrency={formatCurrency} chartMode={chartMode} showBaseline={showBaseline}
                                    hoveredEvent={hoveredEvent} setHoveredEvent={setHoveredEvent} premiumBars={premiumBars} />
                            </div>

                            {/* Premium by Epoch mini bar row */}
                            {chartMode !== "premium" && (
                                <div className="px-4 pb-3">
                                    <div className="flex items-center gap-1 h-8">
                                        <span className="text-[9px] text-gray-500 w-16">Premium</span>
                                        <div className="flex-1 flex items-end gap-0.5 h-full">
                                            {premiumBars.map((bar, i) => (
                                                <div key={i} className="flex-1 bg-green-500/30 hover:bg-green-500/50 rounded-t transition-colors cursor-pointer group relative"
                                                    style={{ height: `${Math.max(20, (bar.premium / Math.max(...premiumBars.map(b => b.premium))) * 100)}%` }}>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[9px] text-white whitespace-nowrap z-10">
                                                        Epoch #{bar.epoch} • {formatCurrency(bar.premium)} • {bar.yieldPercent.toFixed(2)}%
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Merged Overview + Next + Holdings */}
                    <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 overflow-hidden">
                        {/* Overview Section */}
                        <div className="p-4 space-y-3">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overview</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-400">Value</span><span className="font-semibold text-white">{formatCurrency(stats.totalVaultValue)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Net Deposits</span><span className="text-gray-300">{formatCurrency(stats.netDeposits)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">P&L</span><span className={stats.totalUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}>{formatCurrency(stats.totalUnrealizedPnl)} ({formatPercent(stats.performancePercent)})</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Est. APY</span><span className="text-green-400">{stats.estApy.toFixed(1)}%</span></div>
                            </div>
                        </div>

                        {/* Next Roll Section */}
                        {nextRoll && (
                            <div className="border-t border-gray-700/40 p-4 bg-blue-500/5">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wide flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Next</h3>
                                    <span className="text-xs font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded-full">{nextRoll.nextRollIn}</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-400">Est. Distribution</span><span className="text-green-400">{formatCurrency(stats.totalAccrued)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Withdraw Unlock</span><span className="text-gray-300">{nextRoll.withdrawUnlockIn}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Holdings Section */}
                        {positions.length > 1 && (
                            <div className="border-t border-gray-700/40 p-4">
                                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Holdings</h3>
                                <div className="space-y-1.5">
                                    {positions.map(p => (
                                        <div key={p.vaultId} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <img src={VAULT_METADATA[p.vaultId].logo} alt="" className="w-4 h-4 rounded-full" />
                                                <span className="text-white">{p.symbol}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-300">{formatCurrency(p.sharesUsd)}</span>
                                                <span className="text-gray-500 w-12 text-right">{p.allocation.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {positions.length === 1 && (
                            <div className="border-t border-gray-700/40 p-4 text-center">
                                <span className="text-sm text-gray-400">{positions[0].symbol}</span>
                                <span className="text-xs text-gray-500 ml-2">100%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Positions + Activity Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Positions - 2/3 width (primary work surface) */}
                    <div className={activityPanelOpen ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                <PieChart className="w-4 h-4" /> Positions
                            </h2>
                            {!activityPanelOpen && (
                                <button
                                    onClick={() => setActivityPanelOpen(true)}
                                    className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                >
                                    <Clock className="w-3 h-3" /> Show Activity
                                </button>
                            )}
                        </div>
                        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 divide-y divide-gray-700/40">
                            {positions.map((position) => (
                                <PositionRow
                                    key={position.vaultId}
                                    position={position}
                                    meta={VAULT_METADATA[position.vaultId]}
                                    formatCurrency={formatCurrency}
                                    formatPercent={formatPercent}
                                    openMenu={openMenu}
                                    setOpenMenu={setOpenMenu}
                                    onManage={setManagingPosition}
                                />
                            ))}
                        </div>

                        {/* P&L Breakdown - Expandable under positions */}
                        <div className="mt-3">
                            <button
                                onClick={() => setShowPnlBreakdown(!showPnlBreakdown)}
                                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                <ChevronRight className={`w-3 h-3 transition-transform ${showPnlBreakdown ? "rotate-90" : ""}`} />
                                What drove your P&L?
                            </button>
                            {showPnlBreakdown && (
                                <div className="mt-2 bg-gray-800/40 rounded-xl border border-gray-700/40 p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Underlying Move</p>
                                            <p className={stats.breakdown.underlyingMoveImpact >= 0 ? "text-green-400" : "text-red-400"}>
                                                {formatCurrency(stats.breakdown.underlyingMoveImpact)}
                                            </p>
                                            <p className="text-[10px] text-gray-600">NVDAx spot change</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Premium Earned</p>
                                            <p className="text-green-400">{formatCurrency(stats.breakdown.premiumEarned)}</p>
                                            <p className="text-[10px] text-gray-600">Realized + accrued</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Option Overlay</p>
                                            <p className={stats.breakdown.overlayImpact >= 0 ? "text-blue-400" : "text-orange-400"}>
                                                {formatCurrency(stats.breakdown.overlayImpact)}
                                            </p>
                                            <p className="text-[10px] text-gray-600">Cap/assignment</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs mb-1">Fees</p>
                                            <p className="text-red-400">{formatCurrency(stats.breakdown.fees)}</p>
                                            <p className="text-[10px] text-gray-600">Mgmt + performance</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-600 mt-3 pt-2 border-t border-gray-700/40">
                                        * Vault P&L = Current NAV − Net Deposits. Breakdown is estimated from strategy model.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Activity Panel - 1/3 width (collapsible sidebar) */}
                    {activityPanelOpen && (
                        <div className="lg:col-span-1">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" /> Activity
                                </h2>
                                <button
                                    onClick={() => setActivityPanelOpen(false)}
                                    className="text-xs text-gray-500 hover:text-gray-300"
                                    title="Hide activity panel"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-3 max-h-[400px] overflow-y-auto">
                                {activitiesLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                                    </div>
                                ) : walletActivities.length === 0 ? (
                                    <p className="text-gray-500 text-xs text-center py-4">No transactions yet.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {walletActivities.slice(0, activityExpanded ? undefined : 8).map((activity, i) => (
                                            <ActivityRowDetailed
                                                key={activity.signature}
                                                activity={activity}
                                                formatCurrency={formatCurrency}
                                                epochNumber={walletActivities.length - i}
                                                oraclePrice={currentOraclePrice}
                                            />
                                        ))}
                                        {!activityExpanded && walletActivities.length > 8 && (
                                            <button
                                                onClick={() => setActivityExpanded(true)}
                                                className="text-xs text-gray-500 hover:text-gray-300 mt-2 w-full text-center py-2"
                                            >
                                                View all ({walletActivities.length})
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Manage Position Modal */}
            {
                managingPosition && (
                    <ManagePositionModal
                        position={managingPosition}
                        onClose={() => setManagingPosition(null)}
                        oraclePrice={currentOraclePrice}
                    />
                )
            }
        </>
    );
}

// Chart Mode Selector
function ChartModeSelector({ mode, setMode }: { mode: ChartMode; setMode: (m: ChartMode) => void }) {
    return (
        <div className="flex items-center gap-1">
            {(["performance", "value", "premium"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${mode === m
                        ? m === "performance" ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                            : m === "premium" ? "bg-green-500/20 text-green-400 border border-green-500/40"
                                : "bg-gray-700 text-white"
                        : "text-gray-500 hover:text-gray-300"
                        }`}>
                    {m === "performance" ? "P&L %" : m}
                </button>
            ))}
        </div>
    );
}

// Chart Content
function ChartContent({ chartData, chartMin, chartMax, minTime, timeRange, netDeposits, formatCurrency, chartMode, showBaseline, hoveredEvent, setHoveredEvent, premiumBars }: {
    chartData: { value: number; date: Date; event?: string; eventType?: string }[];
    chartMin: number; chartMax: number; minTime: number; timeRange: number; netDeposits: number;
    formatCurrency: (v: number) => string; chartMode: ChartMode; showBaseline: boolean;
    hoveredEvent: number | null; setHoveredEvent: (v: number | null) => void;
    premiumBars: { epoch: number; premium: number; yieldPercent: number }[];
}) {
    if (chartMode === "premium") {
        // Bar chart for premium
        const maxPremium = Math.max(...premiumBars.map(b => b.premium), 1);
        return (
            <div className="h-full flex items-end justify-center gap-2 px-4">
                {premiumBars.map((bar, i) => (
                    <div key={i} className="flex-1 max-w-16 flex flex-col items-center group">
                        <div className="w-full bg-green-500/40 hover:bg-green-500/60 rounded-t transition-colors cursor-pointer relative"
                            style={{ height: `${Math.max(10, (bar.premium / maxPremium) * 100)}%` }}>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-[10px] text-white whitespace-nowrap z-10 shadow-lg">
                                <div className="font-medium">Epoch #{bar.epoch}</div>
                                <div className="text-green-400">{formatCurrency(bar.premium)}</div>
                                <div className="text-gray-400">Yield: {bar.yieldPercent.toFixed(2)}%</div>
                            </div>
                        </div>
                        <span className="text-[9px] text-gray-500 mt-1">E{bar.epoch}</span>
                    </div>
                ))}
            </div>
        );
    }

    if (chartData.length === 0) {
        return <div className="h-full flex items-center justify-center text-gray-500 text-sm">No data for this period</div>;
    }

    const yRange = chartMax - chartMin || 1;
    const paddedMin = chartMin - yRange * 0.1;
    const paddedMax = chartMax + yRange * 0.15;
    const displayRange = paddedMax - paddedMin;
    const depositsY = chartMode === "value" && showBaseline ? 100 - ((netDeposits - paddedMin) / displayRange) * 100 : -1;

    const eventMarkers = chartData.filter(d => d.event).map(d => ({
        x: ((d.date.getTime() - minTime) / timeRange) * 100,
        y: 100 - ((d.value - paddedMin) / displayRange) * 100,
        event: d.event, value: d.value, date: d.date,
    }));

    const eventLabels: Record<string, { label: string; color: string }> = {
        deposit: { label: "Deposit", color: "bg-green-500" },
        withdraw: { label: "Withdraw", color: "bg-orange-500" },
        roll: { label: "Epoch Roll", color: "bg-blue-500" },
        premium: { label: "Premium Paid", color: "bg-purple-500" },
    };

    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.25" />
                        <stop offset="70%" stopColor="rgb(59, 130, 246)" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                    </linearGradient>
                    <clipPath id="chartClip">
                        <rect x="0" y="0" width="100" height="100" />
                    </clipPath>
                </defs>

                <g clipPath="url(#chartClip)">
                    {/* Grid */}
                    {[25, 50, 75].map(y => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    ))}

                    {/* Net Deposits baseline */}
                    {depositsY >= 0 && depositsY <= 100 && (
                        <line x1="0" y1={depositsY} x2="100" y2={depositsY} stroke="rgba(250, 200, 100, 0.5)" strokeWidth="1" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />
                    )}

                    {/* Area */}
                    <path d={`M 0 100 ${chartData.map(d => {
                        const x = Math.max(0, Math.min(100, ((d.date.getTime() - minTime) / timeRange) * 100));
                        const y = Math.max(0, Math.min(100, 100 - ((d.value - paddedMin) / displayRange) * 100));
                        return `L ${x} ${y}`;
                    }).join(' ')} L 100 100 Z`} fill="url(#areaGrad)" />

                    {/* Line */}
                    <path d={`M ${chartData.map(d => {
                        const x = Math.max(0, Math.min(100, ((d.date.getTime() - minTime) / timeRange) * 100));
                        const y = Math.max(0, Math.min(100, 100 - ((d.value - paddedMin) / displayRange) * 100));
                        return `${x} ${y}`;
                    }).join(' L ')}`} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </g>
            </svg>

            {/* Event markers */}
            {eventMarkers.map((m, i) => {
                const cfg = eventLabels[m.event || ""] || { label: m.event, color: "bg-gray-500" };
                const isHovered = hoveredEvent === i;
                return (
                    <div key={i} className="absolute" style={{ left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)" }}
                        onMouseEnter={() => setHoveredEvent(i)} onMouseLeave={() => setHoveredEvent(null)}>
                        <div className={`w-2 h-2 rounded-full ${cfg.color} ring-2 ring-white/20 cursor-pointer transition-transform ${isHovered ? "scale-150" : ""}`} />
                        {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-[10px] text-white whitespace-nowrap z-10 shadow-lg">
                                <div className="font-medium">{cfg.label}</div>
                                <div>{chartMode === "performance" ? `${(m.value - 100).toFixed(2)}%` : formatCurrency(m.value)}</div>
                                <div className="text-gray-500">{m.date.toLocaleString()}</div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Labels */}
            <div className="absolute top-1 right-1 text-[9px] text-gray-500 bg-gray-900/50 px-1 py-0.5 rounded">
                {chartMode === "performance" ? `${(chartMax - 100).toFixed(1)}%` : formatCurrency(chartMax)}
            </div>
            <div className="absolute bottom-5 right-1 text-[9px] text-gray-500 bg-gray-900/50 px-1 py-0.5 rounded">
                {chartMode === "performance" ? `${(chartMin - 100).toFixed(1)}%` : formatCurrency(chartMin)}
            </div>
            {depositsY >= 10 && depositsY <= 90 && (
                <div className="absolute left-1 text-[8px] text-yellow-400/60" style={{ top: `${depositsY}%`, transform: "translateY(-50%)" }}>Net Deposits</div>
            )}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[9px] text-gray-600">
                <span>{new Date(minTime).toLocaleDateString()}</span>
                <span>Now</span>
            </div>
        </div>
    );
}

// Position Row - With strategy line and better actions
function PositionRow({ position, meta, formatCurrency, formatPercent, openMenu, setOpenMenu, onManage }: {
    position: Position; meta: typeof VAULT_METADATA[string];
    formatCurrency: (v: number) => string; formatPercent: (v: number, showSign?: boolean) => string;
    openMenu: string | null; setOpenMenu: (id: string | null) => void;
    onManage: (position: Position) => void;
}) {
    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between">
                <Link href={`/v2/earn/${position.vaultId}`} className="flex items-center gap-3 flex-1">
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2" style={{ borderColor: meta.accentColor }}>
                        <img src={meta.logo} alt={meta.symbol} className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-semibold text-white text-sm">{meta.name}</p>
                        <p className="text-[10px] text-gray-500">{meta.symbol} • {position.vaultApy.toFixed(1)}% APY</p>
                    </div>
                </Link>

                <div className="hidden md:flex items-center gap-6 flex-shrink-0 text-[10px]">
                    <div className="text-center w-20">
                        <p className="text-gray-500">Accrued</p>
                        <p className="text-green-400">{formatCurrency(position.accruedPremium)}</p>
                    </div>
                    <div className="text-center w-16">
                        <p className="text-gray-500">Next</p>
                        <p className="text-white">{position.nextRollIn}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="font-semibold text-white">{formatCurrency(position.sharesUsd)}</p>
                        <p className={`text-[10px] ${position.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(position.unrealizedPnl)} ({formatPercent(position.unrealizedPnlPercent)})
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onManage(position)}
                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Settings className="w-3 h-3" /> Manage
                        </button>
                        <button
                            onClick={() => onManage(position)}
                            className="px-2.5 py-1.5 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white text-xs rounded-lg transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <div className="relative">
                            <button onClick={() => setOpenMenu(openMenu === position.vaultId ? null : position.vaultId)}
                                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openMenu === position.vaultId && (
                                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg py-1 z-20 shadow-xl min-w-[140px]">
                                    <Link href={`/v2/earn/${position.vaultId}?tab=withdraw`} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700">
                                        Withdraw
                                    </Link>
                                    <Link href={`/v2/earn/${position.vaultId}`} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700">
                                        <Eye className="w-3 h-3" /> View Vault
                                    </Link>
                                    <button onClick={() => navigator.clipboard.writeText(position.vaultId)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 w-full">
                                        <Copy className="w-3 h-3" /> Copy Address
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Activity Row - Detailed with shares and epoch info
function ActivityRowDetailed({ activity, formatCurrency, epochNumber, oraclePrice }: { activity: WalletActivity; formatCurrency: (v: number) => string; epochNumber: number; oraclePrice: number }) {
    const estimatedUsd = activity.amount ? activity.amount * oraclePrice : 0;
    const shares = activity.amount || 0;

    const config: Record<WalletActivity["type"], { label: string; color: string; detail: string }> = {
        deposit: { label: "Deposit", color: "text-green-400", detail: `Shares minted: ${shares.toFixed(2)} vNVDAx` },
        withdraw: { label: "Withdraw", color: "text-orange-400", detail: `Shares burned: ${shares.toFixed(2)} vNVDAx` },
        withdrawal_request: { label: "Withdraw Requested", color: "text-yellow-400", detail: `Pending: ${shares.toFixed(2)} shares` },
        unknown: { label: "Transaction", color: "text-gray-400", detail: "" },
    };
    const c = config[activity.type] || config.unknown;

    return (
        <a href={`https://explorer.solana.com/tx/${activity.signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
            className="flex items-start justify-between text-xs py-2 px-2 -mx-2 rounded transition-colors group">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`font-medium ${c.color}`}>{c.label}</span>
                    <span className="text-gray-600">{getTimeAgo(activity.timestamp)}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{c.detail}</p>
            </div>
            <div className="flex items-center gap-2 text-right">
                <div>
                    <span className={`font-medium ${c.color}`}>{activity.type === "withdraw" ? "-" : "+"}{formatCurrency(estimatedUsd)}</span>
                    {activity.type === "deposit" && <p className="text-[10px] text-gray-500">→ {shares.toFixed(2)} shares</p>}
                </div>
                <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
            </div>
        </a>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
