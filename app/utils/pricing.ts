/**
 * Calculates option premium using the Black-Scholes model.
 * 
 * Formula for Call Option:
 * C = S * N(d1) - K * e^(-rt) * N(d2)
 * 
 * Where:
 * d1 = (ln(S/K) + (r + sigma^2/2)t) / (sigma * sqrt(t))
 * d2 = d1 - sigma * sqrt(t)
 * 
 * @param currentPrice (S) Current price of the underlying asset
 * @param strikePrice (K) Strike price of the option
 * @param expiryDate Expiration date
 * @param volatility (sigma) Annualized volatility (default 0.5 or 50%)
 * @param riskFreeRate (r) Risk-free interest rate (default 0.05 or 5%)
 * @returns The estimated premium per share
 */
export function calculateOptionPremium(
    currentPrice: number,
    strikePrice: number,
    expiryDate: Date,
    volatility: number = 0.5,
    riskFreeRate: number = 0.05
): number {
    const now = new Date();
    const timeToExpiryMs = expiryDate.getTime() - now.getTime();

    // If expired, value is just intrinsic (if any)
    if (timeToExpiryMs <= 0) {
        return Math.max(0, currentPrice - strikePrice);
    }

    // Time to expiry in years (t)
    const t = timeToExpiryMs / (1000 * 60 * 60 * 24 * 365);

    const S = currentPrice;
    const K = strikePrice;
    const r = riskFreeRate;
    const sigma = volatility;

    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * t) / (sigma * Math.sqrt(t));
    const d2 = d1 - sigma * Math.sqrt(t);

    const callPrice = S * cumulativeDistribution(d1) - K * Math.exp(-r * t) * cumulativeDistribution(d2);

    // Ensure premium is non-negative and at least a tiny amount if valid
    return Math.max(0.01, callPrice);
}

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * Uses a standard approximation (Abramowitz and Stegun 26.2.17)
 */
function cumulativeDistribution(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.39894228040 * Math.exp(-x * x / 2);
    let prob = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    if (x > 0) prob = 1 - prob;
    return prob;
}
