"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export default function Navbar() {
    return (
        <nav className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
            <Link href="/" className="text-xl font-bold text-blue-500">
                xStock Options
            </Link>
            <div className="flex gap-6">
                <Link href="/" className="hover:text-blue-400 transition">
                    Dashboard
                </Link>
                <Link href="/create" className="hover:text-blue-400 transition">
                    Create Call
                </Link>
                <Link href="/market" className="hover:text-blue-400 transition">
                    Marketplace
                </Link>
            </div>
            <WalletMultiButton />
        </nav>
    );
}
