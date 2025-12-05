import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "../components/AppWalletProvider";
import Navbar from "../components/Navbar";
import TickerTape from "../components/TickerTape";
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
  title: "xOptions",
  description: "Covered Calls for Tokenized Stocks on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white`}
      >
        <AppWalletProvider>
          <Navbar />
          <TickerTape />
          <main className="container mx-auto p-8">
            {children}
          </main>
          <ToastProvider />
        </AppWalletProvider>
      </body>
    </html>
  );
}
