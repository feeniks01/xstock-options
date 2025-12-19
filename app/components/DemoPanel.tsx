"use client";

import { useState, useEffect } from "react";
import { Play, Square, CheckCircle, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

// Minimal demo panel for sidebar - bland styling to not draw attention

interface SidebarDemoPanelProps {
    collapsed?: boolean;
}

interface KeeperHealth {
    status: string;
    lastRunTime: string | null;
    runCount: number;
    isRunning: boolean;
}

export function SidebarDemoPanel({ collapsed = false }: SidebarDemoPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [keeperOnline, setKeeperOnline] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [vaultState, setVaultState] = useState<"IDLE" | "ACTIVE">("IDLE");
    const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

    const keeperUrl = process.env.NEXT_PUBLIC_KEEPER_URL || "http://localhost:3010";

    // Check keeper health
    const checkKeeperHealth = async () => {
        try {
            const response = await fetch(`${keeperUrl}/health`, {
                method: "GET",
                signal: AbortSignal.timeout(3000)
            });
            const data = await response.json();
            setKeeperOnline(data.status === "ok");
        } catch {
            setKeeperOnline(false);
        }
    };

    useEffect(() => {
        checkKeeperHealth();
        const interval = setInterval(checkKeeperHealth, 15000);
        return () => clearInterval(interval);
    }, []);

    const triggerRoll = async () => {
        setIsRolling(true);
        setLastResult(null);
        try {
            const response = await fetch(`${keeperUrl}/trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            setLastResult({ success: data.success, message: data.success ? "Roll complete" : "Roll failed" });
            if (data.success) setVaultState("ACTIVE");
        } catch (error: any) {
            setLastResult({ success: false, message: "Failed" });
        } finally {
            setIsRolling(false);
        }
    };

    const triggerSettlement = async () => {
        setIsSettling(true);
        setLastResult(null);
        try {
            const response = await fetch(`${keeperUrl}/settle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await response.json();
            setLastResult({ success: data.success, message: data.success ? "Settled" : "Failed" });
            if (data.success) setVaultState("IDLE");
        } catch (error: any) {
            setLastResult({ success: false, message: "Failed" });
        } finally {
            setIsSettling(false);
        }
    };

    // Collapsed view - just show icon
    if (collapsed) {
        return (
            <div className="px-2 py-1">
                <div
                    className="flex items-center justify-center h-10 rounded-lg text-muted-foreground/50 hover:bg-secondary/30 cursor-pointer"
                    title="Demo Controls"
                >
                    <div className={`w-2 h-2 rounded-full ${keeperOnline ? 'bg-gray-400' : 'bg-gray-600'}`} />
                </div>
            </div>
        );
    }

    // Expanded sidebar view
    return (
        <div className="px-2 py-1">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between h-10 px-3 rounded-lg text-muted-foreground/70 hover:bg-secondary/30 text-sm transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${keeperOnline ? 'bg-gray-400' : 'bg-gray-600'}`} />
                    <span className="text-[13px]">Demo</span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                ) : (
                    <ChevronDown className="w-3 h-3" />
                )}
            </button>

            {isExpanded && (
                <div className="mt-1 px-3 py-2 space-y-2 bg-secondary/20 rounded-lg border border-border/30">
                    {/* State indicator */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
                        <span>State:</span>
                        <span className="text-muted-foreground">{vaultState}</span>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-1.5">
                        <button
                            onClick={triggerRoll}
                            disabled={!keeperOnline || isRolling || vaultState !== "IDLE"}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] bg-secondary/50 border border-border/50 text-muted-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            {isRolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Roll
                        </button>
                        <button
                            onClick={triggerSettlement}
                            disabled={!keeperOnline || isSettling || vaultState !== "ACTIVE"}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] bg-secondary/50 border border-border/50 text-muted-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSettling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                            Settle
                        </button>
                    </div>

                    {/* Result */}
                    {lastResult && (
                        <div className={`text-[10px] ${lastResult.success ? 'text-muted-foreground' : 'text-red-400/70'}`}>
                            {lastResult.message}
                        </div>
                    )}

                    {/* Keeper status */}
                    <div className="text-[10px] text-muted-foreground/40">
                        Keeper: {keeperOnline ? 'online' : 'offline'}
                    </div>
                </div>
            )}
        </div>
    );
}

export default SidebarDemoPanel;
