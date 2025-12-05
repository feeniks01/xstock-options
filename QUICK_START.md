# Quick Start Guide - xStock Options

## 🚀 Running the Application (Simple Steps)

### Step 1: Verify Dependencies Are Installed

```bash
# Check if root dependencies are installed
cd /Users/juliancastaneda/Repos/xstock-options
test -d node_modules && echo "✓ Root deps installed" || pnpm install

# Check if app dependencies are installed
cd app
test -d node_modules && echo "✓ App deps installed" || pnpm install
```

### Step 2: Verify Environment Variables

The `.env.local` file should already be created with your Bitquery credentials:
- Location: `app/.env.local`
- Should contain:
  ```
  BITQUERY_CLIENT_ID=b1fcf589-61e5-4818-93e4-0d6025e315c9
  BITQUERY_CLIENT_SECRET=tjcellEXeEQL70io1W1XRj8Zkc
  ```

### Step 3: Start the Development Server

```bash
cd app
pnpm dev
```

The app will start at: **http://localhost:3000**

### Step 4: Open in Browser

1. Open http://localhost:3000
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Make sure your wallet is set to **devnet** network

---

## ⚠️ Troubleshooting

### If you see "Failed to fetch price data from Bitquery":

1. **Restart the dev server** - Environment variables only load on startup:
   ```bash
   # Stop the server (Ctrl+C or Cmd+C)
   # Then restart:
   cd app
   pnpm dev
   ```

2. **Verify Bitquery credentials**:
   - Go to https://bitquery.io/ and check your application
   - Make sure the application type is **"Automatic"** (not "Manual")
   - Verify the Client ID and Secret match what's in `.env.local`

3. **Check the terminal logs** - Look for error messages that show:
   - If credentials are being read
   - What the actual error from Bitquery is

### If dependencies aren't installed:

```bash
# Install root dependencies
cd /Users/juliancastaneda/Repos/xstock-options
pnpm install

# Install app dependencies
cd app
pnpm install
```

### If pnpm is not installed:

```bash
npm install -g pnpm
```

---

## 📋 What You Need

- ✅ Node.js 18+ installed
- ✅ pnpm installed (`npm install -g pnpm`)
- ✅ Dependencies installed (run `pnpm install` in root and `app/` directories)
- ✅ `.env.local` file with Bitquery credentials
- ✅ Solana wallet browser extension (Phantom, Solflare, etc.)

---

## 🎯 Quick Command Reference

```bash
# Install all dependencies
cd /Users/juliancastaneda/Repos/xstock-options
pnpm install
cd app && pnpm install

# Run the app
cd app
pnpm dev

# Build for production
cd app
pnpm build
pnpm start
```

---

## 📝 Notes

- The Solana program doesn't need to be deployed to run the UI (it uses an existing program IDL)
- The app connects to Solana **devnet** by default
- Price data comes from Bitquery's xStocks API
- Make sure your wallet is connected to **devnet** network

