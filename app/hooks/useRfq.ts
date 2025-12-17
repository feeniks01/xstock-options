/**
 * useRfq Hook
 * React hook for RFQ (Request for Quote) functionality
 */

import { useState, useEffect, useCallback } from "react";
import {
    createRfq,
    getRfqStatus,
    fillRfq,
    checkRouterHealth,
    calculateCoveredCallParams,
    type RfqStatus,
    type RfqRequest,
} from "../lib/rfq-client";

export interface UseRfqOptions {
    pollInterval?: number; // ms between status polls
    autoFetch?: boolean;
}

export interface UseRfqReturn {
    // Router status
    routerOnline: boolean;
    routerLoading: boolean;

    // Current RFQ
    currentRfq: RfqStatus | null;
    rfqLoading: boolean;

    // Actions
    requestQuote: (params: {
        underlying: string;
        spotPrice: number;
        strikeOffsetPct: number;
        notionalAmount: number;
        epochDurationHours?: number;
    }) => Promise<string | null>;

    acceptBestQuote: () => Promise<boolean>;

    // Status
    quoteCount: number;
    bestPremium: number | null;
    bestMaker: string | null;
    rfqStatus: "IDLE" | "REQUESTING" | "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED" | "ERROR";
    error: string | null;

    // Utilities
    clearRfq: () => void;
    refreshStatus: () => Promise<void>;
}

export function useRfq(options: UseRfqOptions = {}): UseRfqReturn {
    const { pollInterval = 5000, autoFetch = true } = options;

    // Router status
    const [routerOnline, setRouterOnline] = useState(false);
    const [routerLoading, setRouterLoading] = useState(true);

    // RFQ state
    const [currentRfqId, setCurrentRfqId] = useState<string | null>(null);
    const [currentRfq, setCurrentRfq] = useState<RfqStatus | null>(null);
    const [rfqLoading, setRfqLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check router health on mount
    useEffect(() => {
        const checkHealth = async () => {
            setRouterLoading(true);
            const online = await checkRouterHealth();
            setRouterOnline(online);
            setRouterLoading(false);
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // Poll RFQ status when we have an active RFQ
    useEffect(() => {
        if (!currentRfqId || !routerOnline) return;

        let fillTimer: NodeJS.Timeout | null = null;

        const pollStatus = async () => {
            const status = await getRfqStatus(currentRfqId);
            if (status) {
                setCurrentRfq(status);

                // Auto-fill after 5 seconds if we have quotes
                if (status.status === "OPEN" && status.quoteCount > 0 && !fillTimer) {
                    fillTimer = setTimeout(async () => {
                        const result = await fillRfq(currentRfqId);
                        if (result.success) {
                            // Refresh to get filled status
                            const updatedStatus = await getRfqStatus(currentRfqId);
                            if (updatedStatus) setCurrentRfq(updatedStatus);
                        }
                    }, 5000); // Wait 5 seconds to collect more quotes
                }

                // Stop polling if RFQ is no longer open
                if (status.status !== "OPEN") {
                    if (fillTimer) clearTimeout(fillTimer);
                    return;
                }
            }
        };

        pollStatus();
        const interval = setInterval(pollStatus, pollInterval);
        return () => {
            clearInterval(interval);
            if (fillTimer) clearTimeout(fillTimer);
        };
    }, [currentRfqId, routerOnline, pollInterval]);

    // Request a quote
    const requestQuote = useCallback(async (params: {
        underlying: string;
        spotPrice: number;
        strikeOffsetPct: number;
        notionalAmount: number;
        epochDurationHours?: number;
    }): Promise<string | null> => {
        if (!routerOnline) {
            setError("RFQ router is offline");
            return null;
        }

        setRfqLoading(true);
        setError(null);

        try {
            const rfqParams = calculateCoveredCallParams(
                params.spotPrice,
                params.strikeOffsetPct,
                params.notionalAmount,
                params.epochDurationHours
            );

            const request: RfqRequest = {
                ...rfqParams,
                underlying: params.underlying,
                oraclePrice: Math.round(params.spotPrice * 1e6), // 6 decimals
                oracleTs: Math.floor(Date.now() / 1000),
            };

            const response = await createRfq(request);

            if (response.success && response.rfqId) {
                setCurrentRfqId(response.rfqId);
                return response.rfqId;
            } else {
                throw new Error("Failed to create RFQ");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to request quote");
            return null;
        } finally {
            setRfqLoading(false);
        }
    }, [routerOnline]);

    // Accept the best quote
    const acceptBestQuote = useCallback(async (): Promise<boolean> => {
        if (!currentRfqId || !currentRfq?.bestQuote) {
            setError("No quote to accept");
            return false;
        }

        setRfqLoading(true);
        setError(null);

        try {
            const result = await fillRfq(currentRfqId);

            if (result.success) {
                // Refresh status
                const status = await getRfqStatus(currentRfqId);
                if (status) setCurrentRfq(status);
                return true;
            } else {
                throw new Error("Failed to fill RFQ");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to accept quote");
            return false;
        } finally {
            setRfqLoading(false);
        }
    }, [currentRfqId, currentRfq]);

    // Clear current RFQ
    const clearRfq = useCallback(() => {
        setCurrentRfqId(null);
        setCurrentRfq(null);
        setError(null);
    }, []);

    // Manual refresh
    const refreshStatus = useCallback(async () => {
        if (!currentRfqId) return;
        const status = await getRfqStatus(currentRfqId);
        if (status) setCurrentRfq(status);
    }, [currentRfqId]);

    // Computed values
    const rfqStatus = (() => {
        if (error) return "ERROR";
        if (rfqLoading && !currentRfq) return "REQUESTING";
        if (!currentRfq) return "IDLE";
        return currentRfq.status;
    })();

    return {
        routerOnline,
        routerLoading,
        currentRfq,
        rfqLoading,
        requestQuote,
        acceptBestQuote,
        quoteCount: currentRfq?.quoteCount || 0,
        bestPremium: currentRfq?.bestQuote?.premium || null,
        bestMaker: currentRfq?.bestQuote?.maker || null,
        rfqStatus,
        error,
        clearRfq,
        refreshStatus,
    };
}
