"use client";

import { useMemo } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  logo?: string;
}

const mockMovers: Mover[] = [
  { symbol: "NVDAx", name: "NVIDIA", price: 183.12, change: 2.45, logo: "/nvidiax_logo.png" },
  { symbol: "TSLAx", name: "Tesla", price: 248.90, change: 3.21, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg" },
  { symbol: "AMZNx", name: "Amazon", price: 118.55, change: -1.24, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497d354d7140b01657a793_Ticker%3DAMZN%2C%20Company%20Name%3DAmazon.com%20Inc.%2C%20size%3D256x256.svg" },
  { symbol: "METAx", name: "Meta", price: 325.67, change: 1.89, logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg" },
];

export default function MarketMovers() {
  const gainers = useMemo(() => mockMovers.filter(m => m.change > 0).sort((a, b) => b.change - a.change), []);
  const losers = useMemo(() => mockMovers.filter(m => m.change < 0).sort((a, b) => a.change - b.change), []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gainers */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <TrendingUp className="w-[18px] h-[18px] text-green-400" />
          </div>
          <h3 className="font-semibold text-foreground">Top Gainers</h3>
        </div>
        <div className="space-y-3">
          {gainers.map((stock) => (
            <Link
              key={stock.symbol}
              href="/stock"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {stock.logo && (
                  <img src={stock.logo} alt={stock.symbol} className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-foreground group-hover:text-blue-400 transition-colors text-sm">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground">{stock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-foreground">${stock.price.toFixed(2)}</p>
                <p className="text-xs text-green-400">+{stock.change.toFixed(2)}%</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Losers */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <TrendingDown className="w-[18px] h-[18px] text-red-400" />
          </div>
          <h3 className="font-semibold text-foreground">Top Losers</h3>
        </div>
        <div className="space-y-3">
          {losers.length > 0 ? losers.map((stock) => (
            <Link
              key={stock.symbol}
              href="/stock"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {stock.logo && (
                  <img src={stock.logo} alt={stock.symbol} className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-foreground group-hover:text-blue-400 transition-colors text-sm">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground">{stock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-foreground">${stock.price.toFixed(2)}</p>
                <p className="text-xs text-red-400">{stock.change.toFixed(2)}%</p>
              </div>
            </Link>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-4">No losers today 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}
