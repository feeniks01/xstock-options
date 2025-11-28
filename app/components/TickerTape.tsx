"use client";

import { XSTOCKS } from "../utils/constants";

export default function TickerTape() {
    return (
        <div className="w-full bg-secondary/30 border-b border-border overflow-hidden py-2">
            <div className="animate-marquee whitespace-nowrap flex gap-8 items-center">
                {[...XSTOCKS, ...XSTOCKS].map((stock, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        {stock.logo && (
                            <img src={stock.logo} alt={stock.symbol} className="w-5 h-5 rounded-full" />
                        )}
                        <span className="text-foreground font-bold">{stock.symbol}</span>
                        {/* Mock Price Change - Randomize for effect since we don't have real-time data */}
                        <span className={i % 3 === 0 ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
                            {i % 3 === 0 ? "+0.45%" : "-0.21%"}
                        </span>
                    </div>
                ))}
            </div>
            <style jsx>{`
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
        </div>
    );
}
