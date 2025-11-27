"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";

export default function Home() {
  const { publicKey } = useWallet();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
        xStock Options
      </h1>
      <p className="text-xl text-gray-400 text-center max-w-2xl">
        Generate yield on your tokenized stocks. Write covered calls, collect premiums in USDC, and manage your positions on-chain.
      </p>

      {!publicKey ? (
        <div className="p-6 border border-gray-700 rounded-xl bg-gray-800/50">
          <p className="text-lg mb-4">Connect your wallet to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          <Link href="/create" className="group">
            <div className="p-8 border border-gray-700 rounded-xl bg-gray-800 hover:bg-gray-750 transition hover:border-blue-500 cursor-pointer h-full">
              <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400">Write a Call &rarr;</h2>
              <p className="text-gray-400">Lock your xStock and list a covered call option to earn premium.</p>
            </div>
          </Link>
          <Link href="/market" className="group">
            <div className="p-8 border border-gray-700 rounded-xl bg-gray-800 hover:bg-gray-750 transition hover:border-purple-500 cursor-pointer h-full">
              <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-400">Buy Options &rarr;</h2>
              <p className="text-gray-400">Browse available options and purchase exposure to xStocks.</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
