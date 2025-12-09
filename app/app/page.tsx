"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { XSTOCKS, MOCK_MINT, XStock } from "../utils/constants";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import FeaturedMarket from "../components/FeaturedMarket";
import StockCard from "../components/StockCard";
import WhatsNew from "../components/WhatsNew";
import MarketMovers from "../components/MarketMovers";
import ComingSoonPage from "../components/ComingSoonPage";
import { Zap, TrendingUp, Eye, Clock, Wallet, ChevronDown } from "lucide-react";

// Categorize stocks
function categorizeStocks(stocks: XStock[]) {
  const active: XStock[] = [];
  const trending: XStock[] = [];
  const mostWatched: XStock[] = [];
  const comingSoon: XStock[] = [];

  stocks.forEach((stock) => {
    const isMock = stock.mint.toString() === MOCK_MINT.toString();
    
    if (isMock) {
      active.push(stock);
    } else {
      // Mock categorization - in production, use real data
      const hash = stock.symbol.charCodeAt(0) + stock.symbol.charCodeAt(stock.symbol.length - 1);
      
      if (["AMZNx", "TSLAx", "NVDAx", "METAx", "GOOGLx"].includes(stock.symbol)) {
        trending.push(stock);
      } else if (["AAPLx", "MSFTx", "NFLXx", "JPMx", "Vx"].includes(stock.symbol)) {
        mostWatched.push(stock);
      } else {
        comingSoon.push(stock);
      }
    }
  });

  return { active, trending, mostWatched, comingSoon };
}

interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  stocks: XStock[];
  iconBg: string;
  defaultExpanded?: boolean;
}

function CategorySection({ title, icon, stocks, iconBg, defaultExpanded = true }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (stocks.length === 0) return null;

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 mb-4 group w-full text-left"
      >
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-foreground flex-1">{title}</h2>
        <span className="text-sm text-muted-foreground">{stocks.length} stocks</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {stocks.map((stock) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              isActive={stock.mint.toString() === MOCK_MINT.toString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  // Check if coming soon page should be shown
  // Set NEXT_PUBLIC_SHOW_COMING_SOON=true in .env.local to enable
  const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === "true";

  if (showComingSoon) {
    return <ComingSoonPage />;
  }

  const wallet = useWallet();
  const categories = useMemo(() => categorizeStocks(XSTOCKS), []);

  return (
    <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {/* Tagline */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">xOptions</h1>
            <p className="text-muted-foreground">
              First decentralized options for tokenized equities.
            </p>
          </div>

          {/* Quick Actions - Onboarding */}
          {/* <div className="mb-8">
            <QuickActions />
          </div> */}

          {/* Featured Market */}
          <div className="mb-8 relative z-10">
            <FeaturedMarket />
          </div>

          {/* Market Movers + What's New */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <MarketMovers />
            </div>
            <div>
              <WhatsNew />
            </div>
          </div>

          {/* Categorized Stock Grid */}
          <div id="markets" className="relative z-0">
            {/* Active Markets */}
            <CategorySection
              title="Active Markets"
              icon={<Zap className="w-[18px] h-[18px] text-green-400" />}
              iconBg="bg-green-500/20"
              stocks={categories.active}
            />

            {/* Trending Stocks */}
            <CategorySection
              title="Trending Stocks"
              icon={<TrendingUp className="w-[18px] h-[18px] text-blue-400" />}
              iconBg="bg-blue-500/20"
              stocks={categories.trending}
            />

            {/* Most Watched */}
            <CategorySection
              title="Most Watched"
              icon={<Eye className="w-[18px] h-[18px] text-orange-400" />}
              iconBg="bg-orange-500/20"
              stocks={categories.mostWatched}
            />

            {/* Coming Soon */}
            <CategorySection
              title="Coming Soon"
              icon={<Clock className="w-[18px] h-[18px] text-muted-foreground" />}
              iconBg="bg-secondary"
              stocks={categories.comingSoon}
              defaultExpanded={false}
            />
          </div>
        </main>
      </div>
  );
}
