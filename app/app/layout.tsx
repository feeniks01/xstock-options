import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "../components/AppWalletProvider";
import Navbar from "../components/Navbar";
import LiveTicker from "../components/LiveTicker";
import ToastProvider from "../components/ToastProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if coming soon page should be shown
  // When enabled, hide Navbar and LiveTicker for a clean landing page
  const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === "true";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AppWalletProvider>
          <div className="min-h-screen flex flex-col">
            {!showComingSoon && (
              <>
                <Navbar />
                <LiveTicker />
              </>
            )}
            {children}
          </div>
          <ToastProvider />
        </AppWalletProvider>
      </body>
    </html>
  );
}
