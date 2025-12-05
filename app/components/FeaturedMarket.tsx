"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, ArrowRight } from "lucide-react";

interface FeaturedMarketProps {
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  logo?: string;
  volume?: string;
}

export default function FeaturedMarket({
  symbol = "NVDAx",
  name = "NVIDIA xStock",
  price = 182.93,
  change = 0.43,
  logo = "/nvidiax_logo.png",
  volume = "High",
}: FeaturedMarketProps) {
  // Generate sparkline data
  const sparklineData = useMemo(() => {
    const points: number[] = [];
    let value = price * 0.98;
    for (let i = 0; i < 24; i++) {
      value += (Math.random() - 0.48) * 2;
      points.push(value);
    }
    points.push(price);
    return points;
  }, [price]);

  const sparklinePath = useMemo(() => {
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const width = 160;
    const height = 40;
    const padding = 2;

    return sparklineData
      .map((point, i) => {
        const x = (i / (sparklineData.length - 1)) * width;
        const y = height - padding - ((point - min) / range) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [sparklineData]);

  const isPositive = change >= 0;

  return (
    <div className="relative bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 border border-blue-500/20 rounded-xl p-6 overflow-hidden group hover:border-blue-500/40 transition-all">
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          {logo && (
            <div className="relative">
              <img
                src={logo}
                alt={symbol}
                className="w-16 h-16 rounded-full ring-2 ring-blue-500/30"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold text-foreground">{symbol}</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                Featured
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                ACTIVE
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Price Info */}
          <div className="text-right">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground font-mono">
                ${price.toFixed(2)}
              </span>
              <span
                className={`text-lg font-semibold px-2 py-1 rounded ${
                  isPositive
                    ? "text-green-400 bg-green-500/10"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {isPositive ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Volume: <span className="text-foreground font-medium">{volume}</span> • Most Traded Today
            </p>
          </div>

          {/* Sparkline */}
          <div className="hidden md:block">
            <svg width="160" height="40" className="overflow-visible">
              <defs>
                <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Area fill */}
              <path
                d={`${sparklinePath} L 160 40 L 0 40 Z`}
                fill="url(#sparklineGradient)"
              />
              {/* Line */}
              <path
                d={sparklinePath}
                fill="none"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* CTA */}
          <Link
            href="/stock"
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            Trade Options
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
