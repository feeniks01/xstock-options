/**
 * RFQ Client SDK
 * Frontend client for interacting with the RFQ Router API
 */

const RFQ_ROUTER_URL = process.env.NEXT_PUBLIC_RFQ_ROUTER_URL || "http://localhost:3005";

// Types
export interface RfqRequest {
    underlying: string;
    optionType: "CALL" | "PUT";
    expiryTs: number;
    strike: number;
    size: number;
    premiumFloor: number;
    validUntilTs: number;
    settlement: "CASH" | "PHYSICAL";
    oraclePrice: number;
    oracleTs: number;
}

export interface RfqResponse {
    success: boolean;
    rfqId: string;
    request: RfqRequest;
}

export interface Quote {
    premium: number;
    maker: string;
}

export interface RfqStatus {
    id: string;
    underlying: string;
    optionType: string;
    strike: number;
    size: number;
    status: "OPEN" | "FILLED" | "EXPIRED" | "CANCELLED";
    quoteCount: number;
    bestQuote: Quote | null;
}

export interface ActiveRfq {
    id: string;
    underlying: string;
    strike: number;
    size: number;
    quoteCount: number;
}

/**
 * Create a new RFQ for covered call options
 */
export async function createRfq(request: RfqRequest): Promise<RfqResponse> {
    const response = await fetch(`${RFQ_ROUTER_URL}/rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create RFQ");
    }

    return response.json();
}

/**
 * Get status of a specific RFQ
 */
export async function getRfqStatus(rfqId: string): Promise<RfqStatus | null> {
    try {
        const response = await fetch(`${RFQ_ROUTER_URL}/rfq/${rfqId}`);

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error("Failed to get RFQ status");
        }

        const data = await response.json();
        return data.rfq;
    } catch (error) {
        console.error("Error fetching RFQ status:", error);
        return null;
    }
}

/**
 * List all active (open) RFQs
 */
export async function listActiveRfqs(): Promise<ActiveRfq[]> {
    try {
        const response = await fetch(`${RFQ_ROUTER_URL}/rfqs`);

        if (!response.ok) {
            throw new Error("Failed to list RFQs");
        }

        const data = await response.json();
        return data.rfqs || [];
    } catch (error) {
        console.error("Error listing RFQs:", error);
        return [];
    }
}

/**
 * Fill (execute) the best quote for an RFQ
 */
export async function fillRfq(rfqId: string): Promise<{ success: boolean; filled?: { rfqId: string; maker: string; premium: number } }> {
    const response = await fetch(`${RFQ_ROUTER_URL}/rfq/${rfqId}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });

    return response.json();
}

/**
 * Check if RFQ router is available
 */
export async function checkRouterHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${RFQ_ROUTER_URL}/rfqs`, {
            method: "GET",
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Calculate parameters for a covered call RFQ
 */
export function calculateCoveredCallParams(
    spotPrice: number,
    strikeOffsetPct: number,
    notionalAmount: number,
    epochDurationHours: number = 168, // 7 days default
): Omit<RfqRequest, "underlying" | "oraclePrice" | "oracleTs"> {
    const now = Math.floor(Date.now() / 1000);
    const expiryTs = now + epochDurationHours * 60 * 60;
    const validUntilTs = now + 60 * 60; // 1 hour to collect quotes
    const strike = Math.round(spotPrice * (1 + strikeOffsetPct) * 100) / 100;

    // Premium floor: ~0.3% of notional as minimum
    const premiumFloor = Math.round(notionalAmount * 0.003);

    return {
        optionType: "CALL",
        expiryTs,
        strike,
        size: notionalAmount,
        premiumFloor,
        validUntilTs,
        settlement: "CASH",
    };
}

/**
 * Format premium as percentage of notional
 */
export function formatPremiumPct(premium: number, notional: number): string {
    if (notional === 0) return "0.00%";
    return ((premium / notional) * 100).toFixed(2) + "%";
}

/**
 * Format premium as USD
 */
export function formatPremiumUsd(premiumBps: number, notionalUsd: number): string {
    const premium = (premiumBps / 10000) * notionalUsd;
    return "$" + premium.toFixed(2);
}
