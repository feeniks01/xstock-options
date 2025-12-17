"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    Wallet, TrendingUp, TrendingDown, Clock, ChevronRight, ChevronDown,
    PieChart, DollarSign, Percent, ExternalLink, RefreshCw, Zap,
    ArrowUpRight, ArrowDownRight, Activity, Calendar, Filter, ArrowUpDown
} from "lucide-react";
import { useAllVaults } from "../../../hooks/useVault";
import { useWalletActivity, WalletActivity } from "../../../hooks/useWalletActivity";

// Vault metadata
const VAULT_METADATA: Record<string, {
    name: string;
    symbol: string;
    price: number;
    logo: string;
    accentColor: string;
    tier: "Normal" | "Conservative" | "Aggressive";
}> = {
    nvdax: { name: "NVDAx Vault", symbol: "NVDAx", price: 177, logo: "/nvidiax_logo.png", accentColor: "#76B900", tier: "Normal" },
    aaplx: { name: "AAPLx Vault", symbol: "AAPLx", price: 195, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6849799260ee65bf38841f90_Ticker%3DAAPL%2C%20Company%20Name%3DApple%20Inc.%2C%20size%3D256x256.svg", accentColor: "#A2AAAD", tier: "Conservative" },
    tslax: { name: "TSLAx Vault", symbol: "TSLAx", price: 250, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg", accentColor: "#CC0000", tier: "Aggressive" },
    spyx: { name: "SPYx Vault", symbol: "SPYx", price: 590, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685116624ae31d5ceb724895_Ticker%3DSPX%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg", accentColor: "#1E88E5", tier: "Conservative" },
    metax: { name: "METAx Vault", symbol: "METAx", price: 580, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg", accentColor: "#0668E1", tier: "Normal" },
};

type EpochPhase = "rolling" | "open" | "settling" | "distributed";
type SortOption = "tvl" | "premium" | "next-roll" | "apy";

interface Position {
    vaultId: string;
    symbol: string;
    shares: number;
    sharesUsd: number;
    underlyingEquivalent: number;
    sharePrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    unrealizedPnlPercent: number;
    accruedPremium: number;
    accruedPremiumTokens: number;
    lastEpochYield: number;
    lastEpochYieldPercent: number;
    nextRollIn: string;
    withdrawUnlockIn: string;
    status: "active" | "rolling" | "settling";
    epochPhase: EpochPhase;
    epochProgress: number; // 0-100
    epochsDeposited: number;
}

export default function PortfolioPage() {
    const { connected, publicKey } = useWallet();
    const { vaults, loading } = useAllVaults();
    const { activities: walletActivities, loading: activitiesLoading, refresh: refreshActivities } = useWalletActivity();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [chartView, setChartView] = useState<"value" | "premium">("value");
    const [chartRange, setChartRange] = useState<"1W" | "1M" | "ALL">("1W");
    const [sortBy, setSortBy] = useState<SortOption>("tvl");
    const [showFilters, setShowFilters] = useState(false);

    // Calculate positions from vault data
    // For now, assume user owns the entire TVL (they're the only depositor on devnet)
    const positions: Position[] = useMemo(() => {
        const userPositions: Position[] = [];

        // Calculate epoch timing (same logic as vault page)
        const getEpochTiming = () => {
            const now = new Date();
            const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
            const nextSaturday = new Date(now);
            nextSaturday.setUTCDate(now.getUTCDate() + daysUntilSaturday);
            nextSaturday.setUTCHours(23, 59, 59, 999);
            const remaining = Math.max(0, Math.floor((nextSaturday.getTime() - Date.now()) / 1000));
            const hours = Math.floor(remaining / 3600);
            const days = Math.floor(hours / 24);
            const remHours = hours % 24;
            return {
                nextRollIn: `${days}d ${remHours}h`,
                withdrawUnlockIn: `${days}d ${remHours}h`,
                epochProgress: Math.floor(((7 - days) / 7) * 100),
            };
        };

        const epochTiming = getEpochTiming();

        Object.entries(vaults).forEach(([id, vault]) => {
            if (vault && vault.tvl > 0) {
                const meta = VAULT_METADATA[id];
                if (!meta) return;

                // User owns entire TVL for devnet demo
                const userShares = vault.tvl;
                const sharePrice = vault.sharePrice || 1;
                const sharesUsd = userShares * sharePrice * meta.price;
                const underlyingEquivalent = userShares * sharePrice;

                if (userShares > 0) {
                    userPositions.push({
                        vaultId: id,
                        symbol: meta.symbol,
                        shares: userShares,
                        sharesUsd,
                        underlyingEquivalent,
                        sharePrice,
                        unrealizedPnl: sharesUsd * 0.02, // Mock 2% unrealized gain
                        realizedPnl: 0,
                        unrealizedPnlPercent: 2.0,
                        accruedPremium: sharesUsd * 0.008, // ~0.8% weekly premium
                        accruedPremiumTokens: userShares * 0.008,
                        lastEpochYield: sharesUsd * 0.012,
                        lastEpochYieldPercent: 1.2,
                        nextRollIn: epochTiming.nextRollIn,
                        withdrawUnlockIn: epochTiming.withdrawUnlockIn,
                        status: "active",
                        epochPhase: "open",
                        epochProgress: epochTiming.epochProgress,
                        epochsDeposited: 1,
                    });
                }
            }
        });

        // Sort
        switch (sortBy) {
            case "premium": userPositions.sort((a, b) => b.accruedPremium - a.accruedPremium); break;
            case "apy": userPositions.sort((a, b) => b.lastEpochYieldPercent - a.lastEpochYieldPercent); break;
            default: userPositions.sort((a, b) => b.sharesUsd - a.sharesUsd);
        }

        return userPositions;
    }, [vaults, sortBy]);

    // Aggregate stats
    const totalValue = positions.reduce((sum, p) => sum + p.sharesUsd, 0);
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalRealizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
    const totalAccruedPremium = positions.reduce((sum, p) => sum + p.accruedPremium, 0);
    const estApy = positions.length > 0
        ? positions.reduce((sum, p) => sum + (p.lastEpochYieldPercent * 52), 0) / positions.length
        : 0;
    const nextRoll = positions.length > 0 ? positions[0] : null;

    const formatCurrency = (value: number, compact = false) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: compact ? 0 : 2,
            notation: compact && value > 10000 ? "compact" : "standard"
        }).format(value);

    const formatPercent = (value: number, showSign = true) =>
        `${showSign && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshActivities();
        setIsRefreshing(false);
    };

    // Group wallet activities by day
    const groupedActivities = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups: { label: string; items: WalletActivity[] }[] = [];
        const todayItems = walletActivities.filter(a => a.timestamp >= today);
        const yesterdayItems = walletActivities.filter(a => a.timestamp >= yesterday && a.timestamp < today);
        const olderItems = walletActivities.filter(a => a.timestamp < yesterday);

        if (todayItems.length) groups.push({ label: "Today", items: todayItems });
        if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems });
        if (olderItems.length) groups.push({ label: "Earlier", items: olderItems });

        return groups;
    }, [walletActivities]);

    // Not connected state
    if (!connected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-gray-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                <p className="text-gray-400 mb-6 max-w-sm">
                    Connect your wallet to view your vault positions and track your earnings.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Portfolio</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Decision-Grade KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard
                    label="Total Value"
                    value={formatCurrency(totalValue, true)}
                    subValue={`${positions.length} position${positions.length !== 1 ? "s" : ""}`}
                />
                <KpiCard
                    label="Unrealized P&L"
                    value={formatCurrency(totalUnrealizedPnl)}
                    subValue={formatPercent(totalValue > 0 ? (totalUnrealizedPnl / (totalValue - totalUnrealizedPnl)) * 100 : 0)}
                    valueColor={totalUnrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}
                />
                <KpiCard
                    label="Realized P&L"
                    value={formatCurrency(totalRealizedPnl)}
                    subValue="lifetime"
                    valueColor={totalRealizedPnl >= 0 ? "text-green-400" : "text-gray-400"}
                />
                <KpiCard
                    label="Accrued This Epoch"
                    value={formatCurrency(totalAccruedPremium)}
                    subValue={nextRoll ? `pays in ~${nextRoll.nextRollIn}` : "—"}
                    valueColor="text-green-400"
                />
                <KpiCard
                    label="Est. APY"
                    value={formatPercent(estApy, false)}
                    subValue="based on last 7 epochs"
                    valueColor="text-green-400"
                    tooltip="Annualized based on average weekly premium"
                />
            </div>

            {/* What's Next Panel */}
            {positions.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Zap className="w-4 h-4" />
                            <span className="font-medium">What&apos;s Next</span>
                        </div>
                        <span className="text-gray-300">
                            Next roll: <strong className="text-white">{nextRoll?.symbol}</strong> in ~{nextRoll?.nextRollIn}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-300">
                            Est. distribution: <strong className="text-green-400">{formatCurrency(totalAccruedPremium)}</strong>
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-300">
                            Withdrawals unlock: <strong className="text-white">{nextRoll?.withdrawUnlockIn}</strong>
                        </span>
                    </div>
                </div>
            )}

            {/* Mini Performance Chart */}
            <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setChartView("value")}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${chartView === "value" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
                        >
                            Portfolio Value
                        </button>
                        <button
                            onClick={() => setChartView("premium")}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${chartView === "premium" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
                        >
                            Premium Earned
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        {(["1W", "1M", "ALL"] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setChartRange(range)}
                                className={`px-2 py-1 rounded text-xs transition-colors ${chartRange === range ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Chart area */}
                <div className="h-32 flex items-end gap-1">
                    {Array.from({ length: 30 }).map((_, i) => {
                        const height = chartView === "value"
                            ? 40 + Math.sin(i * 0.3) * 20 + i * 1.5
                            : 20 + Math.sin(i * 0.5) * 10 + (i % 7 === 0 ? 30 : 0);
                        return (
                            <div
                                key={i}
                                className={`flex-1 rounded-t transition-all ${chartView === "value" ? "bg-blue-500/50" : "bg-green-500/50"}`}
                                style={{ height: `${Math.min(height, 100)}%` }}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-600">
                    <span>{chartRange === "1W" ? "7d ago" : chartRange === "1M" ? "30d ago" : "Start"}</span>
                    <span>Now</span>
                </div>
            </div>

            {/* Vault Positions */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-gray-400" />
                        Vault Positions
                    </h2>
                    <div className="flex items-center gap-2">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:outline-none"
                        >
                            <option value="tvl">Sort: Value</option>
                            <option value="premium">Sort: Premium</option>
                            <option value="apy">Sort: APY</option>
                            <option value="next-roll">Sort: Next Roll</option>
                        </select>
                    </div>
                </div>

                {positions.length === 0 ? (
                    <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-6 text-center">
                        <p className="text-gray-400 mb-4">No active positions</p>
                        <Link
                            href="/v2"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-black font-medium rounded-lg transition-colors"
                        >
                            Explore Vaults
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {positions.map((position) => (
                            <PositionCard
                                key={position.vaultId}
                                position={position}
                                meta={VAULT_METADATA[position.vaultId]}
                                formatCurrency={formatCurrency}
                                formatPercent={formatPercent}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    Recent Activity
                </h2>

                <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4 space-y-4">
                    {activitiesLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
                            <span className="ml-2 text-gray-500 text-sm">Loading transactions...</span>
                        </div>
                    ) : groupedActivities.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                            No vault transactions found. Deposit to a vault to see activity here.
                        </p>
                    ) : (
                        groupedActivities.map((group) => (
                            <div key={group.label}>
                                <p className="text-xs text-gray-500 uppercase mb-2">{group.label}</p>
                                <div className="space-y-2">
                                    {group.items.map((activity, i) => (
                                        <ActivityRow key={activity.signature} activity={activity} formatCurrency={formatCurrency} />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Components

function KpiCard({
    label, value, subValue, valueColor = "text-white", tooltip
}: {
    label: string; value: string; subValue: string; valueColor?: string; tooltip?: string;
}) {
    return (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-3" title={tooltip}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
            <p className="text-xs text-gray-500">{subValue}</p>
        </div>
    );
}

function PositionCard({
    position, meta, formatCurrency, formatPercent
}: {
    position: Position;
    meta: typeof VAULT_METADATA[string];
    formatCurrency: (v: number, compact?: boolean) => string;
    formatPercent: (v: number, showSign?: boolean) => string;
}) {
    const statusColors = {
        active: "bg-green-500/20 text-green-400",
        rolling: "bg-yellow-500/20 text-yellow-400",
        settling: "bg-blue-500/20 text-blue-400",
    };

    const phaseLabels: Record<EpochPhase, string> = {
        rolling: "Rolling",
        open: "Open",
        settling: "Settling",
        distributed: "Distributed",
    };

    return (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4 hover:border-gray-600/50 transition-colors">
            {/* Main content */}
            <div className="flex items-start justify-between gap-4">
                {/* Left: Logo + Info */}
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{ borderColor: meta.accentColor, borderWidth: "2px" }}
                    >
                        <img src={meta.logo} alt={meta.symbol} className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{meta.symbol}</h3>
                            <span className="text-xs text-gray-500">{meta.tier}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[position.status]}`}>
                                {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            {position.shares.toFixed(2)} shares ≈ {position.underlyingEquivalent.toFixed(2)} {meta.symbol}
                        </p>
                    </div>
                </div>

                {/* Middle: Stats Grid */}
                <div className="hidden md:grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500">Pending Premium</p>
                        <p className="text-green-400 font-medium">{formatCurrency(position.accruedPremium)}</p>
                        <p className="text-xs text-gray-600">{position.accruedPremiumTokens.toFixed(4)} {meta.symbol}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Last Epoch</p>
                        <p className="text-white font-medium">{formatCurrency(position.lastEpochYield)}</p>
                        <p className="text-xs text-gray-600">{formatPercent(position.lastEpochYieldPercent)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Next Roll</p>
                        <p className="text-white font-medium">{position.nextRollIn}</p>
                        <p className="text-xs text-gray-600">unlock: {position.withdrawUnlockIn}</p>
                    </div>
                </div>

                {/* Right: Value + Actions */}
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="font-bold text-white">{formatCurrency(position.sharesUsd)}</p>
                        <p className={`text-sm ${position.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(position.unrealizedPnl)} ({formatPercent(position.unrealizedPnlPercent)})
                        </p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Link
                            href={`/v2/earn/${position.vaultId}`}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-black text-xs font-medium rounded-lg transition-colors"
                        >
                            Deposit
                        </Link>
                        <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                            Withdraw
                        </button>
                    </div>
                    <Link href={`/v2/earn/${position.vaultId}`}>
                        <ChevronRight className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                    </Link>
                </div>
            </div>

            {/* Epoch Progress Bar */}
            <div className="mt-3 pt-3 border-t border-gray-700/40">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Epoch Progress</span>
                    <span className="text-gray-400">{phaseLabels[position.epochPhase]}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                    <div className="h-full bg-yellow-500" style={{ width: "15%" }} />
                    <div className="h-full bg-green-500" style={{ width: `${Math.max(0, position.epochProgress - 15)}%` }} />
                    <div className="h-full bg-blue-500" style={{ width: position.epochPhase === "settling" ? "10%" : "0%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Rolling</span>
                    <span>Open</span>
                    <span>Settling</span>
                    <span>Distributed</span>
                </div>
            </div>
        </div>
    );
}

function ActivityRow({ activity, formatCurrency }: { activity: WalletActivity; formatCurrency: (v: number, c?: boolean) => string }) {
    const config: Record<WalletActivity["type"], { label: string; color: string; icon: React.ReactNode }> = {
        deposit: { label: "Deposited", color: "text-blue-400", icon: <ArrowUpRight className="w-4 h-4" /> },
        withdraw: { label: "Withdrew", color: "text-orange-400", icon: <ArrowDownRight className="w-4 h-4" /> },
        withdrawal_request: { label: "Withdrawal Requested", color: "text-yellow-400", icon: <Clock className="w-4 h-4" /> },
        unknown: { label: "Vault Transaction", color: "text-gray-400", icon: <Zap className="w-4 h-4" /> },
    };

    const c = config[activity.type] || config.unknown;
    const timeAgo = getTimeAgo(activity.timestamp);

    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg bg-gray-700/50 ${c.color}`}>
                    {c.icon}
                </div>
                <div>
                    <p className="text-white">{c.label}</p>
                    <p className="text-xs text-gray-500">
                        {activity.success ? "" : "⚠️ Failed • "}
                        {timeAgo}
                    </p>
                </div>
            </div>
            <div className="text-right">
                {activity.amount && (
                    <p className={`font-medium ${c.color}`}>
                        {activity.type === "withdraw" ? "-" : "+"}{activity.amount.toFixed(2)}
                    </p>
                )}
                <a
                    href={`https://explorer.solana.com/tx/${activity.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1 justify-end"
                >
                    {activity.signature.slice(0, 8)}...
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
