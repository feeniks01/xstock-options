"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { XSTOCKS, MOCK_MINT } from "../utils/constants";
import Link from "next/link";

export default function DashboardPage() {
  const wallet = useWallet();
  const [selectedStock, setSelectedStock] = useState(MOCK_MINT.toBase58());

  if (!wallet.publicKey) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Connect your wallet to view stocks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">xStock Options</h1>
        <p className="text-muted-foreground">Select a stock to trade options</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {XSTOCKS.map((stock, index) => {
          const isMock = stock.mint.toString() === MOCK_MINT.toString();
          const isSelected = selectedStock === stock.mint.toString();

          return (
            <button
              key={stock.symbol}
              onClick={() => {
                setSelectedStock(stock.mint.toString());
                if (isMock) {
                  window.location.href = "/stock";
                }
              }}
              className={`
                                relative bg-card border rounded-lg p-4 transition-all
                                ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border hover:border-muted-foreground/30'}
                                ${!isMock ? 'opacity-60' : ''}
                            `}
            >
              {index === 0 && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                  ACTIVE
                </div>
              )}
              {!isMock && (
                <div className="absolute -top-2 -right-2 bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded">
                  SOON
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                {stock.logo && (
                  <img
                    src={stock.logo}
                    alt={stock.name}
                    className="w-16 h-16 rounded-full"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                )}
                <div className="text-center">
                  <p className="font-bold text-foreground">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{stock.name}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedStock && selectedStock !== MOCK_MINT.toString() && (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-{foreground">
            Options trading for {XSTOCKS.find(s => s.mint.toString() === selectedStock)?.name} will be available soon.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            For now, try creating options with <span className="font-semibold text-foreground">Mock xStock</span>
          </p>
          <Link
            href="/stock"
            className="inline-block mt-6 bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Create Mock Options
          </Link>
        </div>
      )}

      {selectedStock === MOCK_MINT.toString() && (
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Mock xStock Active</h2>
          <p className="text-muted-foreground mb-6">
            Start trading options on the test xStock token
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/stock"
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Trade Options
            </Link>
            <a
              href="/stock"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Trade Options
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
