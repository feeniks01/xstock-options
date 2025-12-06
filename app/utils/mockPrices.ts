import { XSTOCKS } from "./constants";

// Mock prices - in production, fetch real data
export const MOCK_PRICES: Record<string, number> = {
  NVDAx: 183.12,
  AMZNx: 232.62,
  AAPLx: 279.52,
  GOOGLx: 320.57,
  MSFTx: 484.72,
  METAx: 673.37,
  TSLAx: 455.30,
  NFLXx: 100.24,
  JPMx: 315.04,
  Vx: 331.24,
};

// Mock changes (percentage) - can be customized per stock
export const MOCK_CHANGES: Record<string, number> = {
  NVDAx: 2.45,
  AMZNx: -1.24,
  AAPLx: 1.89,
  GOOGLx: 0.67,
  MSFTx: 1.23,
  METAx: 3.21,
  TSLAx: 2.15,
  NFLXx: -0.89,
  JPMx: 0.43,
  Vx: 0.56,
};

// Get mock price for a symbol, or return random fallback
export function getMockPrice(symbol: string): number {
  return MOCK_PRICES[symbol] ?? Math.floor(Math.random() * 200 + 50);
}

// Get mock change for a symbol, or return random fallback
export function getMockChange(symbol: string): number {
  if (MOCK_CHANGES[symbol] !== undefined) {
    return MOCK_CHANGES[symbol];
  }
  return parseFloat((Math.random() * 6 - 3).toFixed(2));
}

// Get stock data with mock prices
export function getStockWithPrice(symbol: string) {
  const stock = XSTOCKS.find((s) => s.symbol === symbol);
  if (!stock) return null;
  
  return {
    ...stock,
    price: getMockPrice(symbol),
    change: getMockChange(symbol),
  };
}
