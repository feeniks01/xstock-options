"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Coins, Shield, TrendingUp, PieChart, Activity, Settings } from "lucide-react";

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

const UI_SCALES = [
    { label: "Compact", value: 0.95 },
    { label: "Default", value: 1.00 },
    { label: "Comfortable", value: 1.08 },
    { label: "Large", value: 1.15 },
];

export default function V2Layout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [uiScale, setUiScale] = useState(1.0);
    const [showScaleMenu, setShowScaleMenu] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        const savedScale = localStorage.getItem("uiScale");
        if (savedScale) {
            const scale = parseFloat(savedScale);
            setUiScale(scale);
            document.documentElement.style.setProperty("--ui-scale", String(scale));
        }
        const savedSidebar = localStorage.getItem("sidebarCollapsed");
        if (savedSidebar) {
            setSidebarCollapsed(savedSidebar === "true");
        }
    }, []);

    const handleScaleChange = (scale: number) => {
        setUiScale(scale);
        document.documentElement.style.setProperty("--ui-scale", String(scale));
        localStorage.setItem("uiScale", String(scale));
        setShowScaleMenu(false);
    };

    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem("sidebarCollapsed", String(newState));
    };

    const navItems = [
        { href: "/v2", label: "Earn", icon: Coins },
        { href: "/v2/oracle", label: "Oracle", icon: Activity },
        { href: "/v2/protect", label: "Protect", icon: Shield, comingSoon: true },
        { href: "/v2/trade", label: "Trade", icon: TrendingUp, advanced: true },
        { href: "/v2/portfolio", label: "Portfolio", icon: PieChart },
    ];

    const isActive = (href: string) => {
        if (href === "/v2") return pathname === "/v2" || pathname === "/v2/earn";
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Top Header */}
            <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="h-16 flex justify-between items-center px-6">
                    <div className="flex items-center gap-6">
                        <Link href="/v2" className="flex items-center gap-3">
                            <img src="/OptionsFi_logo.png" alt="OptionsFi" className="h-8 w-auto" />
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                V2 Beta
                            </span>
                        </Link>

                        {/* V1/V2 Toggle */}
                        <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border">
                            <Link
                                href="/"
                                className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            >
                                V1
                            </Link>
                            <div className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 text-blue-400">
                                V2
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Oracle Health Badge */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-medium text-green-400">Oracle: Healthy</span>
                        </div>

                        {/* Network Badge */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border">
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                            <span className="text-xs font-medium text-muted-foreground">Devnet</span>
                        </div>

                        {/* UI Scale Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowScaleMenu(!showScaleMenu)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/80 transition-colors"
                            >
                                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{Math.round(uiScale * 100)}%</span>
                            </button>
                            {showScaleMenu && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                                    {UI_SCALES.map((s) => (
                                        <button
                                            key={s.value}
                                            onClick={() => handleScaleChange(s.value)}
                                            className={`w-full px-3 py-2 text-xs text-left hover:bg-secondary/50 transition-colors ${uiScale === s.value ? 'bg-secondary text-white' : 'text-muted-foreground'
                                                }`}
                                        >
                                            {s.label} ({Math.round(s.value * 100)}%)
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <WalletMultiButton className="!bg-secondary !text-secondary-foreground hover:!bg-secondary/80 !rounded-lg !h-10 !px-4 !text-sm !font-medium !border !border-border" />
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Left Sidebar - Collapsible */}
                <aside className={`${sidebarCollapsed ? 'w-16' : 'w-52'} border-r border-border bg-background/50 transition-all duration-200 flex flex-col`}>
                    {/* Sidebar Header Row */}
                    <div className={`h-12 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-end'} px-3 border-b border-border/50`}>
                        <button
                            onClick={toggleSidebar}
                            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Nav Items */}
                    <nav className="flex-1 px-2 py-3 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.comingSoon ? "#" : item.href}
                                    className={`flex items-center h-11 ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                        : item.comingSoon
                                            ? "text-muted-foreground/50 cursor-not-allowed"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                        }`}
                                    title={sidebarCollapsed ? item.label : undefined}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    {!sidebarCollapsed && (
                                        <>
                                            <span>{item.label}</span>
                                            {item.comingSoon && (
                                                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                                    Soon
                                                </span>
                                            )}
                                            {item.advanced && (
                                                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                                                    Adv
                                                </span>
                                            )}
                                        </>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-4 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
