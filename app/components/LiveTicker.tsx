"use client";

import { XSTOCKS, MOCK_MINT } from "../utils/constants";
import { MOCK_PRICES, getMockPrice, getMockChange } from "../utils/mockPrices";

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  logo?: string;
}

// Generate mock prices - in production, fetch real data
function generateMockPrices(): TickerItem[] {
  // Filter to only show stocks that have prices defined, then take first 15
  return XSTOCKS.filter((stock) => MOCK_PRICES[stock.symbol] !== undefined)
    .slice(0, 15)
    .map((stock) => ({
      symbol: stock.symbol,
      price: getMockPrice(stock.symbol),
      change: getMockChange(stock.symbol),
      logo: stock.logo,
    }));
}

export default function LiveTicker() {
  const tickerItems = generateMockPrices();

  return (
    <div className="w-full bg-background/80 backdrop-blur-sm border-b border-border overflow-hidden py-3">
      <div className="relative flex">
        <div className="animate-scroll flex gap-12 items-center whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div
              key={`${item.symbol}-${i}`}
              className="flex items-center gap-3 text-sm font-medium group cursor-pointer hover:opacity-80 transition-opacity"
            >
              {item.logo && (
                <img
                  src={item.logo}
                  alt={item.symbol}
                  className="w-6 h-6 rounded-full ring-1 ring-border"
                />
              )}
              <span className="text-foreground font-bold">{item.symbol}</span>
              <span className="text-muted-foreground font-mono">
                ${item.price.toFixed(2)}
              </span>
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  item.change >= 0
                    ? "text-green-400 bg-green-500/10"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {item.change >= 0 ? "+" : ""}
                {item.change.toFixed(2)}%
              </span>
              <span className="text-border mx-2">│</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animate-scroll {
          animation: scroll 45s linear infinite;
        }
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
