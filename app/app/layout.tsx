import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "../components/AppWalletProvider";
import Navbar from "../components/Navbar";
import LiveTicker from "../components/LiveTicker";
import ToastProvider from "../components/ToastProvider";
import { Analytics } from "@vercel/analytics/next";
import { validateBypassToken } from "../lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "xOptions — Decentralized Options for Tokenized Stocks",
  description: "Trade options on real-world stocks, fully on-chain. Fast, permissionless, cash-settled.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if coming soon page should be shown
  const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === "true";
  
  // Check for valid bypass token
  const cookieStore = await cookies();
  const bypassToken = cookieStore.get('bypass_token')?.value;
  const hasValidBypass = validateBypassToken(bypassToken);
  
  // Show navbar/ticker if coming soon is disabled OR user has bypass token
  const showNavbar = !showComingSoon || hasValidBypass;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AppWalletProvider>
          <div className="min-h-screen flex flex-col">
            {showNavbar && (
              <>
                <Navbar />
                <LiveTicker />
              </>
            )}
            {children}
          </div>
          <ToastProvider />
        </AppWalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
