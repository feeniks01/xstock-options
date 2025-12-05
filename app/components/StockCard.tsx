"use client";

import Link from "next/link";
import { useMemo } from "react";
import { XStock, MOCK_MINT } from "../utils/constants";

interface StockCardProps {
  stock: XStock;
  price?: number;
  change?: number;
  impliedVol?: number;
  volume?: "Low" | "Medium" | "High";
  isActive?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function StockCard({
  stock,
  price,
  change,
  impliedVol,
  volume = "Medium",
  isActive = false,
  onClick,
  isSelected = false,
}: StockCardProps) {
  const isMock = stock.mint.toString() === MOCK_MINT.toString();
  const displayPrice = price ?? (isMock ? 183.12 : Math.floor(Math.random() * 200 + 50));
  const displayChange = change ?? (Math.random() * 6 - 3);
  const displayIV = impliedVol ?? Math.floor(Math.random() * 40 + 15);
  const isPositive = displayChange >= 0;
  const isOptionsActive = isMock || isActive;

  // Volatility-based glow effect
  const glowIntensity = useMemo(() => {
    if (!isOptionsActive) return "";
    if (displayIV > 40) return "shadow-orange-500/20";
    if (displayIV > 30) return "shadow-blue-500/20";
    return "shadow-green-500/10";
  }, [displayIV, isOptionsActive]);

  // Generate mini sparkline
  const sparklinePoints = useMemo(() => {
    const points: number[] = [];
    let value = 50;
    for (let i = 0; i < 12; i++) {
      value += (Math.random() - 0.5) * 15;
      value = Math.max(20, Math.min(80, value));
      points.push(value);
    }
    // End trending with the change
    points[points.length - 1] = isPositive ? 65 : 35;
    return points.map((y, x) => `${x * 7},${y}`).join(" ");
  }, [isPositive]);

  const CardContent = (
    <div
      className={`
        relative bg-card border rounded-xl p-4 transition-all duration-300
        ${isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border hover:border-muted-foreground/50"}
        ${isOptionsActive ? `hover:shadow-lg ${glowIntensity}` : "opacity-70"}
        ${isOptionsActive ? "cursor-pointer" : ""}
        group
      `}
      onClick={isOptionsActive ? onClick : undefined}
    >
      {/* Status Badge */}
      {isOptionsActive && (
        <div className="absolute top-2 right-2 z-10">
          <span className="flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-green-500/30">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            ACTIVE
          </span>
        </div>
      )}
      {!isOptionsActive && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
            SOON
          </span>
        </div>
      )}

      {/* Logo & Symbol */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {stock.logo && (
            <div className="relative">
              <img
                src={stock.logo}
                alt={stock.name}
                className={`w-12 h-12 rounded-full ring-2 transition-all ${
                  isOptionsActive
                    ? "ring-blue-500/30 group-hover:ring-blue-500/50"
                    : "ring-border"
                }`}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                }}
              />
            </div>
          )}
          <div>
            <p className="font-bold text-foreground text-lg group-hover:text-blue-400 transition-colors">
              {stock.symbol}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[100px]">
              {stock.name.replace(" xStock", "")}
            </p>
          </div>
        </div>

        {/* Mini Sparkline */}
        <svg
          width="80"
          height="30"
          className="opacity-50 group-hover:opacity-100 transition-opacity"
        >
          <polyline
            points={sparklinePoints}
            fill="none"
            stroke={isPositive ? "#22c55e" : "#ef4444"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Price & Change */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl font-bold font-mono text-foreground">
          ${displayPrice.toFixed(2)}
        </span>
        <span
          className={`text-sm font-semibold px-2 py-0.5 rounded ${
            isPositive
              ? "text-green-400 bg-green-500/10"
              : "text-red-400 bg-red-500/10"
          }`}
        >
          {isPositive ? "+" : ""}
          {displayChange.toFixed(2)}%
        </span>
      </div>

      {/* IV & Volume */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">IV:</span>
          <span
            className={`font-semibold ${
              displayIV > 40
                ? "text-orange-400"
                : displayIV > 25
                  ? "text-blue-400"
                  : "text-green-400"
            }`}
          >
            {displayIV}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Vol:</span>
          <span
            className={`font-semibold ${
              volume === "High"
                ? "text-green-400"
                : volume === "Medium"
                  ? "text-blue-400"
                  : "text-muted-foreground"
            }`}
          >
            {volume}
          </span>
        </div>
      </div>

      {/* Hover Overlay */}
      {isOptionsActive && (
        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
      )}
    </div>
  );

  if (isOptionsActive && isMock) {
    return (
      <Link href="/stock" className="block">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
