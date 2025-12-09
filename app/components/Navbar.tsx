"use client";

import dynamic from 'next/dynamic';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, ExternalLink } from "lucide-react";

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export default function Navbar() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto h-16 flex justify-between items-center" style={{
                    maxWidth: "100%",
                    padding: "0 10px"
                }}>
                <Link href="/" className="flex items-center gap-3 group">
                    <img 
                        src="/OptionsFi_logo.png" 
                        alt="OptionsFi" 
                        className="h-8 w-auto"
                    />
                </Link>

                <div className="hidden md:flex items-center gap-6">
                    <Link 
                        href="/" 
                        className={`text-sm font-medium transition-colors ${
                            isActive('/') ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Markets
                    </Link>
                    <Link 
                        href="/stock" 
                        className={`text-sm font-medium transition-colors ${
                            isActive('/stock') ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Trade
                    </Link>
                    <a
                        href="https://github.com/feeniks01/xstock-options/blob/main/README.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                        Docs
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                <div className="flex items-center gap-4">
                    {/* Network Badge */}
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-xs font-medium text-muted-foreground">Devnet</span>
                    </div>

                    <WalletMultiButton className="!bg-secondary !text-secondary-foreground hover:!bg-secondary/80 !rounded-lg !h-10 !px-4 !text-sm !font-medium !border !border-border" />
                </div>
            </div>
        </nav>
    );
}
