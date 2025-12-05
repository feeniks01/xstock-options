# xOptions Frontend

A Next.js web application for trading covered call options on tokenized stocks on Solana.

## Prerequisites

- Node.js 18+ (or latest LTS version)
- npm or pnpm package manager
- A Solana wallet browser extension (Phantom, Solflare, etc.)

## Installation

1. Navigate to the app directory:
```bash
cd app
```

2. Install dependencies:
```bash
npm install
```
or
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your Bitquery OAuth2 credentials:
```
BITQUERY_CLIENT_ID=your_client_id_here
BITQUERY_CLIENT_SECRET=your_client_secret_here
```

To get credentials:
1. Go to [Bitquery](https://bitquery.io/) and create an account
2. Create a new **Automatic** application (for server use)
3. Copy the **Client ID** and **Client Secret**

The app uses Bitquery's xStocks API for real-time price data from the Solana blockchain.

## Running the Development Server

Start the development server:

```bash
npm run dev
```
or
```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

Open the URL in your browser and connect your Solana wallet to start using the application.

## Building for Production

Build the production-ready application:

```bash
npm run build
```
or
```bash
pnpm build
```

Start the production server:

```bash
npm start
```
or
```bash
pnpm start
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Features

- Connect Solana wallet
- View available stocks with real-time price data from [Bitquery xStocks API](https://docs.bitquery.io/docs/blockchain/Solana/xstocks-api/)
- Trade options on tokenized stocks
- View options chain
- Manage positions
- View trading history
- Live OHLC candlestick charts
- 24h volume and market statistics

