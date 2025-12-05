/**
 * Options Mathematics Library
 * 
 * Comprehensive Black-Scholes pricing, Greeks calculation, and Implied Volatility
 * reverse engineering for xStock options trading.
 * 
 * Uses historical price data from Bitquery to calculate HV as IV proxy.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MATHEMATICAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error function (erf) approximation using Abramowitz-Stegun method
 * Maximum error: 1.5 × 10^−7
 */
export function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * N(x) = probability that a standard normal random variable is <= x
 */
export function normCdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Standard Normal Probability Density Function (PDF)
 * n(x) = (1/√(2π)) * e^(-x²/2)
 */
export function normPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLACK-SCHOLES PRICING
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlackScholesParams {
    S: number;      // Spot price (current stock price)
    K: number;      // Strike price
    r: number;      // Risk-free interest rate (annualized, e.g., 0.05 for 5%)
    sigma: number;  // Volatility (annualized, e.g., 0.35 for 35%)
    T: number;      // Time to expiration in years (e.g., 0.25 for 3 months)
    q?: number;     // Dividend yield (optional, default 0)
}

export interface BlackScholesResult {
    d1: number;
    d2: number;
    callPrice: number;
    putPrice: number;
}

/**
 * Calculate d1 and d2 parameters for Black-Scholes
 */
export function calculateD1D2(params: BlackScholesParams): { d1: number; d2: number } {
    const { S, K, r, sigma, T, q = 0 } = params;
    
    // Handle edge cases
    if (T <= 0) {
        // At expiration, option is worth intrinsic value only
        return { d1: S > K ? Infinity : -Infinity, d2: S > K ? Infinity : -Infinity };
    }
    if (sigma <= 0) {
        return { d1: S > K ? Infinity : -Infinity, d2: S > K ? Infinity : -Infinity };
    }
    
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    
    return { d1, d2 };
}

/**
 * Black-Scholes European Call Option Price
 * C = S * e^(-qT) * N(d1) - K * e^(-rT) * N(d2)
 */
export function blackScholesCall(params: BlackScholesParams): number {
    const { S, K, r, T, q = 0 } = params;
    
    // At or past expiration
    if (T <= 0) {
        return Math.max(0, S - K);
    }
    
    const { d1, d2 } = calculateD1D2(params);
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    
    return S * Math.exp(-q * T) * Nd1 - K * Math.exp(-r * T) * Nd2;
}

/**
 * Black-Scholes European Put Option Price
 * P = K * e^(-rT) * N(-d2) - S * e^(-qT) * N(-d1)
 */
export function blackScholesPut(params: BlackScholesParams): number {
    const { S, K, r, T, q = 0 } = params;
    
    // At or past expiration
    if (T <= 0) {
        return Math.max(0, K - S);
    }
    
    const { d1, d2 } = calculateD1D2(params);
    const NminusD1 = normCdf(-d1);
    const NminusD2 = normCdf(-d2);
    
    return K * Math.exp(-r * T) * NminusD2 - S * Math.exp(-q * T) * NminusD1;
}

/**
 * Calculate both call and put prices efficiently
 */
export function blackScholes(params: BlackScholesParams): BlackScholesResult {
    const { d1, d2 } = calculateD1D2(params);
    const callPrice = blackScholesCall(params);
    const putPrice = blackScholesPut(params);
    
    return { d1, d2, callPrice, putPrice };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GREEKS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface Greeks {
    delta: number;      // Rate of change of option price with respect to underlying
    gamma: number;      // Rate of change of delta with respect to underlying
    theta: number;      // Rate of change of option price with respect to time (per day)
    vega: number;       // Rate of change of option price with respect to volatility (per 1%)
    rho: number;        // Rate of change of option price with respect to interest rate (per 1%)
}

/**
 * Calculate all Greeks for a Call option
 */
export function callGreeks(params: BlackScholesParams): Greeks {
    const { S, K, r, sigma, T, q = 0 } = params;
    
    if (T <= 0 || sigma <= 0) {
        // At expiration or zero vol
        const isITM = S > K;
        return {
            delta: isITM ? 1 : 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: isITM ? K * T : 0
        };
    }
    
    const { d1, d2 } = calculateD1D2(params);
    const sqrtT = Math.sqrt(T);
    const nd1 = normPdf(d1);
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    const expQT = Math.exp(-q * T);
    const expRT = Math.exp(-r * T);
    
    // Delta: ∂C/∂S = e^(-qT) * N(d1)
    const delta = expQT * Nd1;
    
    // Gamma: ∂²C/∂S² = e^(-qT) * n(d1) / (S * σ * √T)
    const gamma = expQT * nd1 / (S * sigma * sqrtT);
    
    // Theta: ∂C/∂t (per year, we'll convert to per day)
    // θ = -S * e^(-qT) * n(d1) * σ / (2√T) - r * K * e^(-rT) * N(d2) + q * S * e^(-qT) * N(d1)
    const thetaAnnual = -(S * expQT * nd1 * sigma) / (2 * sqrtT)
                        - r * K * expRT * Nd2
                        + q * S * expQT * Nd1;
    const theta = thetaAnnual / 365; // Convert to per day
    
    // Vega: ∂C/∂σ (per 1% change in volatility)
    // ν = S * e^(-qT) * √T * n(d1)
    const vegaRaw = S * expQT * sqrtT * nd1;
    const vega = vegaRaw / 100; // Per 1% IV change
    
    // Rho: ∂C/∂r (per 1% change in interest rate)
    // ρ = K * T * e^(-rT) * N(d2)
    const rhoRaw = K * T * expRT * Nd2;
    const rho = rhoRaw / 100; // Per 1% rate change
    
    return { delta, gamma, theta, vega, rho };
}

/**
 * Calculate all Greeks for a Put option
 */
export function putGreeks(params: BlackScholesParams): Greeks {
    const { S, K, r, sigma, T, q = 0 } = params;
    
    if (T <= 0 || sigma <= 0) {
        const isITM = S < K;
        return {
            delta: isITM ? -1 : 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: isITM ? -K * T : 0
        };
    }
    
    const { d1, d2 } = calculateD1D2(params);
    const sqrtT = Math.sqrt(T);
    const nd1 = normPdf(d1);
    const NminusD1 = normCdf(-d1);
    const NminusD2 = normCdf(-d2);
    const expQT = Math.exp(-q * T);
    const expRT = Math.exp(-r * T);
    
    // Delta: ∂P/∂S = e^(-qT) * (N(d1) - 1) = -e^(-qT) * N(-d1)
    const delta = -expQT * NminusD1;
    
    // Gamma: Same as call (gamma is symmetric)
    const gamma = expQT * nd1 / (S * sigma * sqrtT);
    
    // Theta
    const thetaAnnual = -(S * expQT * nd1 * sigma) / (2 * sqrtT)
                        + r * K * expRT * NminusD2
                        - q * S * expQT * NminusD1;
    const theta = thetaAnnual / 365;
    
    // Vega: Same as call (vega is symmetric)
    const vegaRaw = S * expQT * sqrtT * nd1;
    const vega = vegaRaw / 100;
    
    // Rho: ∂P/∂r = -K * T * e^(-rT) * N(-d2)
    const rhoRaw = -K * T * expRT * NminusD2;
    const rho = rhoRaw / 100;
    
    return { delta, gamma, theta, vega, rho };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPLIED VOLATILITY CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ImpliedVolResult {
    iv: number;           // Implied volatility (annualized decimal)
    iterations: number;   // Number of iterations to converge
    converged: boolean;   // Whether the algorithm converged
    error: number;        // Final pricing error
}

/**
 * Calculate Implied Volatility using Bisection Method
 * 
 * Reverse-engineers the volatility from an option's market price by finding
 * the sigma that makes Black-Scholes price equal to the observed market price.
 * 
 * @param marketPrice - Observed option market price
 * @param S - Spot price
 * @param K - Strike price
 * @param r - Risk-free rate
 * @param T - Time to expiration (years)
 * @param type - 'call' or 'put'
 * @param tolerance - Price tolerance for convergence (default 0.0001)
 * @param maxIterations - Maximum iterations (default 100)
 */
export function impliedVolBisection(
    marketPrice: number,
    S: number,
    K: number,
    r: number,
    T: number,
    type: 'call' | 'put' = 'call',
    tolerance: number = 0.0001,
    maxIterations: number = 100
): ImpliedVolResult {
    // Validate inputs
    if (marketPrice <= 0) {
        return { iv: 0, iterations: 0, converged: false, error: Infinity };
    }
    
    // Check for intrinsic value violations
    const intrinsicCall = Math.max(0, S - K * Math.exp(-r * T));
    const intrinsicPut = Math.max(0, K * Math.exp(-r * T) - S);
    const intrinsic = type === 'call' ? intrinsicCall : intrinsicPut;
    
    if (marketPrice < intrinsic - tolerance) {
        // Price below intrinsic value - arbitrage situation
        return { iv: 0, iterations: 0, converged: false, error: intrinsic - marketPrice };
    }
    
    // Bisection bounds: 0.01% to 500% volatility
    let low = 0.0001;
    let high = 5.0;
    let mid = 0.25; // Start at 25% as initial guess
    
    const priceFunc = type === 'call' ? blackScholesCall : blackScholesPut;
    
    for (let i = 0; i < maxIterations; i++) {
        mid = (low + high) / 2;
        const price = priceFunc({ S, K, r, sigma: mid, T });
        const error = price - marketPrice;
        
        if (Math.abs(error) < tolerance) {
            return { iv: mid, iterations: i + 1, converged: true, error: Math.abs(error) };
        }
        
        if (error > 0) {
            // Price too high, reduce volatility
            high = mid;
        } else {
            // Price too low, increase volatility
            low = mid;
        }
    }
    
    // Return best guess even if not converged
    return { iv: mid, iterations: maxIterations, converged: false, error: Math.abs(priceFunc({ S, K, r, sigma: mid, T }) - marketPrice) };
}

/**
 * Calculate Implied Volatility using Newton-Raphson Method
 * Faster convergence than bisection but may fail for extreme cases
 */
export function impliedVolNewtonRaphson(
    marketPrice: number,
    S: number,
    K: number,
    r: number,
    T: number,
    type: 'call' | 'put' = 'call',
    tolerance: number = 0.0001,
    maxIterations: number = 50
): ImpliedVolResult {
    // Initial guess using Brenner-Subrahmanyam approximation
    let sigma = Math.sqrt(2 * Math.PI / T) * (marketPrice / S);
    sigma = Math.max(0.01, Math.min(2.0, sigma)); // Clamp to reasonable range
    
    const priceFunc = type === 'call' ? blackScholesCall : blackScholesPut;
    
    for (let i = 0; i < maxIterations; i++) {
        const params = { S, K, r, sigma, T };
        const price = priceFunc(params);
        const error = price - marketPrice;
        
        if (Math.abs(error) < tolerance) {
            return { iv: sigma, iterations: i + 1, converged: true, error: Math.abs(error) };
        }
        
        // Vega = ∂C/∂σ (we need raw vega, not scaled)
        const { d1 } = calculateD1D2(params);
        const vega = S * Math.sqrt(T) * normPdf(d1);
        
        if (Math.abs(vega) < 1e-10) {
            // Vega too small, fall back to bisection
            return impliedVolBisection(marketPrice, S, K, r, T, type, tolerance, maxIterations);
        }
        
        // Newton-Raphson update: σ_new = σ - f(σ)/f'(σ)
        const sigmaNew = sigma - error / vega;
        
        // Clamp to prevent wild swings
        sigma = Math.max(0.001, Math.min(5.0, sigmaNew));
    }
    
    return { iv: sigma, iterations: maxIterations, converged: false, error: Math.abs(priceFunc({ S, K, r, sigma, T }) - marketPrice) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORICAL VOLATILITY CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface HistoricalVolatilityResult {
    hv: number;           // Historical volatility (annualized)
    hvDaily: number;      // Daily volatility (not annualized)
    sampleSize: number;   // Number of returns used
    stdDev: number;       // Standard deviation of returns
    meanReturn: number;   // Mean daily return
}

/**
 * Calculate Historical Volatility from price data
 * Uses close-to-close log returns
 * 
 * @param prices - Array of prices (chronological order, oldest first)
 * @param periodsPerYear - Trading periods per year (252 for daily, 365*24 for hourly)
 */
export function calculateHistoricalVolatility(
    prices: number[],
    periodsPerYear: number = 252
): HistoricalVolatilityResult {
    if (prices.length < 2) {
        return { hv: 0.35, hvDaily: 0.35 / Math.sqrt(252), sampleSize: 0, stdDev: 0, meanReturn: 0 };
    }
    
    // Calculate log returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > 0 && prices[i - 1] > 0) {
            returns.push(Math.log(prices[i] / prices[i - 1]));
        }
    }
    
    if (returns.length < 2) {
        return { hv: 0.35, hvDaily: 0.35 / Math.sqrt(252), sampleSize: 0, stdDev: 0, meanReturn: 0 };
    }
    
    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // Calculate variance (using sample variance with Bessel's correction)
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    
    // Standard deviation
    const stdDev = Math.sqrt(variance);
    
    // Annualize: multiply by sqrt(periods per year)
    const hv = stdDev * Math.sqrt(periodsPerYear);
    
    return {
        hv: Math.max(0.05, Math.min(3.0, hv)), // Clamp to 5%-300%
        hvDaily: stdDev,
        sampleSize: returns.length,
        stdDev,
        meanReturn
    };
}

/**
 * Calculate multiple Historical Volatility windows
 * Useful for volatility term structure analysis
 */
export function calculateVolatilityWindows(
    prices: number[],
    periodsPerYear: number = 252
): {
    hv5: number;    // 5-period HV
    hv10: number;   // 10-period HV
    hv20: number;   // 20-period HV
    hv60: number;   // 60-period HV
    hvAll: number;  // Full period HV
    hvWeighted: number; // Weighted average for IV estimation
} {
    const hv5 = calculateHistoricalVolatility(prices.slice(-6), periodsPerYear).hv;
    const hv10 = calculateHistoricalVolatility(prices.slice(-11), periodsPerYear).hv;
    const hv20 = calculateHistoricalVolatility(prices.slice(-21), periodsPerYear).hv;
    const hv60 = calculateHistoricalVolatility(prices.slice(-61), periodsPerYear).hv;
    const hvAll = calculateHistoricalVolatility(prices, periodsPerYear).hv;
    
    // Weighted average: emphasize recent volatility for IV estimation
    // 40% recent (10-period), 30% medium (20-period), 20% longer (60-period), 10% full
    const hvWeighted = hv10 * 0.4 + hv20 * 0.3 + hv60 * 0.2 + hvAll * 0.1;
    
    return { hv5, hv10, hv20, hv60, hvAll, hvWeighted };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLATILITY SURFACE & SMILE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adjust base IV for volatility smile/skew and term structure
 * Creates realistic IV surface patterns seen in real markets
 */
export function adjustIVForSmile(
    baseIV: number,
    strike: number,
    spot: number,
    T: number, // Time to expiration in years
    type: 'call' | 'put'
): number {
    let iv = baseIV;
    
    // ═══════════════════════════════════════════════════════════════════
    // TERM STRUCTURE ADJUSTMENT
    // Short-term options typically have higher IV (volatility spike risk)
    // ═══════════════════════════════════════════════════════════════════
    const daysToExpiry = T * 365;
    
    if (daysToExpiry < 1) {
        iv *= 1.50; // +50% for < 1 day (gamma risk)
    } else if (daysToExpiry < 7) {
        iv *= 1.25; // +25% for < 1 week
    } else if (daysToExpiry < 30) {
        iv *= 1.10; // +10% for < 1 month
    } else if (daysToExpiry > 90) {
        iv *= 0.95; // -5% for > 3 months (mean reversion)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // VOLATILITY SKEW/SMILE ADJUSTMENT
    // OTM puts have higher IV (crash protection)
    // Deep ITM and OTM options have elevated IV (smile effect)
    // ═══════════════════════════════════════════════════════════════════
    const moneyness = strike / spot; // >1 = OTM call, <1 = ITM call (OTM put)
    const logMoneyness = Math.log(moneyness);
    const moneynessDistance = Math.abs(logMoneyness);
    
    if (type === 'put') {
        // Put skew: OTM puts have significantly higher IV
        if (moneyness < 1) { // OTM put
            // Classic "fear premium" - downside protection
            iv *= 1 + moneynessDistance * 3.5;
        } else { // ITM put
            iv *= 1 + moneynessDistance * 0.8;
        }
    } else {
        // Call skew: more symmetric smile
        if (moneyness > 1) { // OTM call
            iv *= 1 + moneynessDistance * 2.0;
        } else { // ITM call
            iv *= 1 + moneynessDistance * 0.5;
        }
    }
    
    // Clamp to reasonable bounds: 5% to 300%
    return Math.max(0.05, Math.min(3.0, iv));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE OPTION PRICING
// ═══════════════════════════════════════════════════════════════════════════════

export interface OptionPriceWithGreeks {
    price: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    iv: number;
    intrinsicValue: number;
    timeValue: number;
    isITM: boolean;
}

/**
 * Price an option with all Greeks and metadata
 */
export function priceOption(
    spot: number,
    strike: number,
    r: number,
    baseIV: number,
    T: number, // Years to expiration
    type: 'call' | 'put'
): OptionPriceWithGreeks {
    // Adjust IV for smile and term structure
    const iv = adjustIVForSmile(baseIV, strike, spot, T, type);
    
    const params: BlackScholesParams = { S: spot, K: strike, r, sigma: iv, T };
    
    // Calculate price
    const price = type === 'call' ? blackScholesCall(params) : blackScholesPut(params);
    
    // Calculate Greeks
    const greeks = type === 'call' ? callGreeks(params) : putGreeks(params);
    
    // Calculate intrinsic and time value
    const intrinsicValue = type === 'call' 
        ? Math.max(0, spot - strike) 
        : Math.max(0, strike - spot);
    const timeValue = Math.max(0, price - intrinsicValue);
    
    // Determine ITM status
    const isITM = type === 'call' ? spot > strike : spot < strike;
    
    return {
        price,
        ...greeks,
        iv,
        intrinsicValue,
        timeValue,
        isITM
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert time units to years
 */
export function timeToYears(value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'): number {
    switch (unit) {
        case 'minutes': return value / (365 * 24 * 60);
        case 'hours': return value / (365 * 24);
        case 'days': return value / 365;
        case 'weeks': return value / 52;
        case 'months': return value / 12;
    }
}

/**
 * Default risk-free rate (approximate current rate)
 * In production, this should be fetched from a reliable source
 */
export const DEFAULT_RISK_FREE_RATE = 0.05; // 5% annual

/**
 * Format IV for display
 */
export function formatIV(iv: number): string {
    return `${(iv * 100).toFixed(1)}%`;
}

/**
 * Format Greeks for display
 */
export function formatGreek(value: number, decimals: number = 3): string {
    if (Math.abs(value) < 0.001) return '< 0.001';
    return value.toFixed(decimals);
}
