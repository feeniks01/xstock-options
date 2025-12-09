import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — xOptions",
  description: "Learn how to use xStock Options - a Solana-based covered call options protocol",
};

/**
 * Documentation Page
 * 
 * Displays the project README content in a nicely formatted page.
 * Accessible at /docs
 */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            xStock Options
          </h1>
          <p className="text-xl text-muted-foreground">
            A Solana-based covered call options protocol built on synthetic equities from xStocks, using USDC as collateral.
          </p>
        </div>

        {/* How to Use */}
        <Section title="How to Use">
          <p className="text-muted-foreground mb-4">
            xStock Options allows you to trade covered call options on synthetic stocks (like synthetic AAPL, TSLA, NVDA, etc.) directly on Solana.
          </p>

          <SubSection title="For Option Sellers (Writing Covered Calls)">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li><strong className="text-foreground">Browse Available Stocks:</strong> Visit the platform and browse synthetic stocks available for trading</li>
              <li><strong className="text-foreground">Select a Stock:</strong> Choose a synthetic stock you own (e.g., xNVDA, xAAPL)</li>
              <li><strong className="text-foreground">Create a Covered Call:</strong>
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li>Lock your synthetic stock into a vault</li>
                  <li>Set your strike price (the price at which the option can be exercised)</li>
                  <li>Choose an expiration date</li>
                  <li>Set your premium (the price you want to receive for selling the option)</li>
                </ul>
              </li>
              <li><strong className="text-foreground">List Your Option:</strong> Your option will appear in the marketplace for others to buy</li>
              <li><strong className="text-foreground">Receive Premium:</strong> When someone buys your option, you immediately receive the premium in USDC</li>
              <li><strong className="text-foreground">Manage Your Position:</strong>
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li>If the option expires without being exercised, you can reclaim your stock</li>
                  <li>If the option is exercised, you receive the strike price in USDC and the buyer gets your stock</li>
                </ul>
              </li>
            </ol>
          </SubSection>

          <SubSection title="For Option Buyers">
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li><strong className="text-foreground">Browse Options Chain:</strong> View available options for different synthetic stocks</li>
              <li><strong className="text-foreground">Select an Option:</strong> Choose an option with your desired strike price and expiration</li>
              <li><strong className="text-foreground">Buy the Option:</strong> Pay the premium in USDC to purchase the option</li>
              <li><strong className="text-foreground">Manage Your Position:</strong>
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li><strong>Exercise:</strong> If the stock price exceeds the strike price before expiration, exercise the option to buy the stock at the strike price</li>
                  <li><strong>Resell:</strong> You can list your option for resale at a new price if you don't want to exercise it</li>
                  <li><strong>Let it Expire:</strong> If the stock price stays below the strike price, the option expires worthless</li>
                </ul>
              </li>
            </ol>
          </SubSection>
        </Section>

        {/* Key Benefits */}
        <Section title="Key Benefits">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BenefitCard
              title="24/7 Trading"
              description="Synthetic stocks trade continuously on Solana, even when traditional markets are closed"
            />
            <BenefitCard
              title="Transparent Pricing"
              description="Option premiums are calculated using Black-Scholes pricing based on real-time volatility"
            />
            <BenefitCard
              title="Secondary Market"
              description="Buy and sell options before expiration"
            />
            <BenefitCard
              title="No Intermediaries"
              description="Direct peer-to-peer trading on the blockchain"
            />
          </div>
        </Section>

        {/* What It Does */}
        <Section title="What It Does">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
            <p className="text-orange-300 font-medium">
              <strong>American-Style Options:</strong> All options are American-style, meaning buyers can exercise their options at any time before expiration, not just at expiry.
            </p>
          </div>
          
          <p className="text-muted-foreground mb-4">xStock Options enables users to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Lock xStock (synthetic AAPL, TSLA, etc.) into a vault</li>
            <li>List covered calls with strike, expiry, and premium</li>
            <li>Buy and resell options on a simple secondary market</li>
            <li><strong className="text-foreground">Exercise options anytime before expiration</strong> (American-style) to receive the underlying xStock</li>
            <li>Reclaim stock if the option was never sold or expires</li>
          </ul>
        </Section>

        {/* Covered Call Lifecycle */}
        <Section title="Covered Call Lifecycle">
          <div className="space-y-6">
            <LifecycleStep
              number={1}
              title="Create"
              items={[
                "Seller calls create_covered_call with strike, expiry, amount, and premium",
                "Program transfers amount of xStock from the seller to a PDA vault",
                "CoveredCall account is initialized and marked as listed",
              ]}
            />
            <LifecycleStep
              number={2}
              title="Buy"
              items={[
                "Buyer calls buy_option",
                "Program checks the option is listed, not expired, and not exercised",
                "Buyer pays the premium in USDC to the current owner",
                "CoveredCall records the buyer and is marked as unlisted",
              ]}
            />
            <LifecycleStep
              number={3}
              title="List for Resale"
              items={[
                "Current owner calls list_for_sale with a new ask price",
                "CoveredCall is marked as listed again",
              ]}
            />
            <LifecycleStep
              number={4}
              title="Exercise (American-Style)"
              items={[
                "Buyer can call exercise at any time before the expiration timestamp",
                "Program transfers strike amount in USDC from buyer to seller",
                "PDA vault sends xStock to the buyer",
                "CoveredCall is marked as exercised",
              ]}
            />
            <LifecycleStep
              number={5}
              title="Reclaim"
              items={[
                "If the option expired or was never sold, seller calls reclaim",
                "PDA vault sends any remaining xStock back to seller",
                "CoveredCall is marked as cancelled",
              ]}
            />
          </div>
        </Section>

        {/* Pricing and Volatility */}
        <Section title="Pricing and Volatility">
          <p className="text-muted-foreground mb-4">
            Option premiums are computed off-chain in the frontend using the Black-Scholes model:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Pull recent prices of the xStock asset</li>
            <li>Compute log returns: <code className="bg-secondary px-2 py-0.5 rounded text-sm">r_i = ln(S_i / S_&#123;i-1&#125;)</code></li>
            <li>Compute the standard deviation of returns and annualize it</li>
            <li>Plug the resulting volatility into a Black-Scholes call formula to obtain a fair premium</li>
            <li>Use that premium as the initial ask_price when creating a covered call</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            This approach works 24/7 because synthetic xStocks trade continuously on Solana, even when the underlying equity markets are closed.
          </p>
        </Section>

        {/* Stack */}
        <Section title="Tech Stack">
          <div className="flex flex-wrap gap-2">
            {["Solana", "Anchor", "xStocks", "USDC (Circle)", "Next.js", "TypeScript", "Tailwind CSS"].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// Helper Components

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-foreground mb-6 pb-2 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function BenefitCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-4">
      <h4 className="font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function LifecycleStep({ number, title, items }: { number: number; title: string; items: string[] }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-foreground mb-2">{title}</h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
