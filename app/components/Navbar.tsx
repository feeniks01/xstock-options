"use client";

import dynamic from 'next/dynamic';
import Link from "next/link";
import { usePathname } from "next/navigation";

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export default function Navbar() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="border-b border-border bg-background sticky top-0 z-50">
            <div className="container mx-auto px-6 h-16 flex justify-between items-center">
                <Link href="/" className="text-lg font-semibold tracking-tight text-foreground hover:text-muted-foreground transition-colors">
                    xOptions
                </Link>

                <div className="hidden md:flex gap-8">
                    {/* Links removed as per request */}
                </div>

                <WalletMultiButton className="!bg-secondary !text-secondary-foreground hover:!bg-secondary/80 !rounded-md !h-9 !px-4 !text-sm !font-medium !border !border-border" />
            </div>
        </nav>
    );
}
