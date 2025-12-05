"use client";

import { useMemo } from "react";
import PositionCard from "../components/PositionCard";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Lightweight mock endpoint to visualize an owned position without needing
// an active wallet/positions. This page is only for testing/demo.
export default function MockPositionPage() {
  const currentPrice = 229.75; // Underlying spot reference

  // Mock position data modeled after the owned-position reference
  const mockPosition = useMemo(() => {
    return {
      publicKey: new PublicKey("11111111111111111111111111111111"),
      account: {
        strike: new BN(250 * 100_000_000), // $250 strike with 8 decimals
        premium: new BN(19.4 * 1_000_000), // $19.40 premium (6 decimals)
        expiryTs: new BN(Math.floor(new Date("2026-05-15").getTime() / 1000)),
        exercised: false,
        isListed: false,
        askPrice: new BN(0),
        seller: new PublicKey("22222222222222222222222222222222"),
        buyer: new PublicKey("33333333333333333333333333333333"),
      },
    };
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-[0.12em]">
            Demo endpoint
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Owned Position Preview
          </h1>
          <p className="text-muted-foreground">
            A mock position rendered without requiring wallet connectivity.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Underlying</p>
          <p className="text-xl font-semibold text-foreground">
            AMZN · ${currentPrice.toFixed(2)}
          </p>
        </div>
      </div>

      <PositionCard
        position={mockPosition}
        currentPrice={currentPrice}
        isSeller={true}
        symbol="AMZN"
        onExercise={() => alert("Mock: exercise")}
        onReclaim={() => alert("Mock: reclaim")}
        onListForSale={(price) => alert(`Mock: list for sale at $${price.toFixed(2)}`)}
        onCancelListing={() => alert("Mock: cancel listing")}
      />
    </div>
  );
}
