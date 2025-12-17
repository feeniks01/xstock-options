"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Zap, Shield, Clock, TrendingUp, Users, Building, Code } from "lucide-react";

/**
 * V2 Documentation Page
 * 
 * Comprehensive documentation for OptionsFi V2 Vault system.
 * Accessible at /v2/docs
 */
export default function V2DocsPage() {
    const [openSection, setOpenSection] = useState<string | null>("overview");

    return (
        <div className="max-w-5xl mx-auto px-4 py-4">
            {/* Navigation */}
            <Link href="/v2" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Earn
            </Link>

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <h1 className="text-4xl font-bold text-white">
                        OptionsFi V2
                    </h1>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        Devnet Live
                    </span>
                </div>
                <p className="text-xl text-gray-400 max-w-3xl">
                    Earn passive yield on your xStock tokens through automated covered call strategies.
                    Professional-grade options infrastructure, simplified for everyone.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard label="Strategy" value="Covered Calls" />
                <StatCard label="Epoch Length" value="7 Days" />
                <StatCard label="Target APY" value="15-60%" />
                <StatCard label="Strike Offset" value="10% OTM" />
            </div>

            {/* Accordion Sections */}
            <div className="space-y-3">
                <AccordionSection
                    id="overview"
                    title="What is OptionsFi?"
                    icon={<Zap className="w-5 h-5" />}
                    isOpen={openSection === "overview"}
                    onToggle={() => setOpenSection(openSection === "overview" ? null : "overview")}
                >
                    <p className="text-gray-400 mb-4">
                        OptionsFi is a <strong className="text-white">DeFi covered call vault</strong> built on Solana.
                        It enables users to earn yield on their xStock tokens (synthetic stock tokens) by automatically
                        writing covered call options.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <FeatureCard
                            title="Passive Yield"
                            description="Deposit tokens and earn premium income without active management"
                        />
                        <FeatureCard
                            title="Professional Strategy"
                            description="Covered call writing used by institutional investors worldwide"
                        />
                        <FeatureCard
                            title="On-Chain Execution"
                            description="Transparent, verifiable transactions on Solana"
                        />
                        <FeatureCard
                            title="RFQ Infrastructure"
                            description="Institutional-grade pricing from competing market makers"
                        />
                    </div>
                </AccordionSection>

                <AccordionSection
                    id="covered-calls"
                    title="Understanding Covered Calls"
                    icon={<TrendingUp className="w-5 h-5" />}
                    isOpen={openSection === "covered-calls"}
                    onToggle={() => setOpenSection(openSection === "covered-calls" ? null : "covered-calls")}
                >
                    <p className="text-gray-400 mb-4">
                        A <strong className="text-white">covered call</strong> is an options strategy where you own
                        an underlying asset and sell call options against it to generate income.
                    </p>

                    <div className="bg-gray-800/50 rounded-xl p-6 mb-6 font-mono text-sm">
                        <p className="text-green-400 mb-2">Example: NVDAx Covered Call</p>
                        <div className="space-y-1 text-gray-300">
                            <p>You own: 100 NVDAx (worth $17,710 at $177.10/share)</p>
                            <p>You sell: Call option with $195 strike, 7 days expiry</p>
                            <p>You receive: $150 premium (0.85% yield)</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <p className="text-gray-400 mb-2">Scenarios at expiry:</p>
                            <p className="text-green-400">✓ NVDA at $180 → Keep shares + $150 premium</p>
                            <p className="text-green-400">✓ NVDA at $190 → Keep shares + $150 premium</p>
                            <p className="text-yellow-400">△ NVDA at $200 → Sell at $195, keep $150 (missed $5 upside)</p>
                        </div>
                    </div>

                    <p className="text-gray-400">
                        <strong className="text-white">Key Insight:</strong> You collect premium regardless of price movement.
                        The trade-off is capping your upside if the price rises significantly above the strike.
                    </p>
                </AccordionSection>

                <AccordionSection
                    id="vault"
                    title="How the Vault Works"
                    icon={<Building className="w-5 h-5" />}
                    isOpen={openSection === "vault"}
                    onToggle={() => setOpenSection(openSection === "vault" ? null : "vault")}
                >
                    <div className="space-y-6">
                        <Step number={1} title="Deposit">
                            <p>Deposit xStock tokens (e.g., NVDAx) into the vault. You receive vault shares (vNVDAx)
                                representing your ownership.</p>
                        </Step>

                        <Step number={2} title="Epoch Starts">
                            <p>At the start of each epoch, the vault calculates the strike price (current price + 10% OTM)
                                and broadcasts an RFQ to market makers.</p>
                        </Step>

                        <Step number={3} title="Collect Quotes">
                            <p>Market makers submit competing quotes. The vault selects the best quote (highest premium)
                                and accepts it.</p>
                        </Step>

                        <Step number={4} title="Premium Earned">
                            <p>The premium is credited to the vault. This yield accrues to all depositors proportionally.</p>
                        </Step>

                        <Step number={5} title="Settlement">
                            <p>At epoch end, options settle based on the final price. If price stayed below strike,
                                vault keeps full premium. If above, difference is paid out.</p>
                        </Step>

                        <Step number={6} title="Withdraw">
                            <p>After epoch ends, you can claim your tokens plus accumulated yield.</p>
                        </Step>
                    </div>
                </AccordionSection>

                <AccordionSection
                    id="epochs"
                    title="Epoch Lifecycle"
                    icon={<Clock className="w-5 h-5" />}
                    isOpen={openSection === "epochs"}
                    onToggle={() => setOpenSection(openSection === "epochs" ? null : "epochs")}
                >
                    <p className="text-gray-400 mb-6">
                        Epochs are fixed 7-day periods during which options are active. Here's the timeline:
                    </p>

                    <div className="bg-gray-800/50 rounded-xl overflow-hidden mb-6">
                        <div className="grid grid-cols-7 text-center text-xs text-gray-500 py-2 border-b border-gray-700">
                            <div>Day 0</div>
                            <div>Day 1</div>
                            <div>Day 2</div>
                            <div>Day 3</div>
                            <div>Day 4</div>
                            <div>Day 5</div>
                            <div>Day 6-7</div>
                        </div>
                        <div className="grid grid-cols-7">
                            <div className="p-2 bg-green-500/20 text-green-400 text-xs text-center">Start</div>
                            <div className="p-2 text-gray-500 text-xs text-center col-span-4">Active</div>
                            <div className="p-2 bg-blue-500/20 text-blue-400 text-xs text-center">Settle</div>
                            <div className="p-2 bg-purple-500/20 text-purple-400 text-xs text-center">Claim</div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <InfoCard title="Deposits" status="Anytime">
                            New deposits join the next epoch's collateral pool.
                        </InfoCard>
                        <InfoCard title="Withdrawals" status="Epoch End">
                            Request withdrawal anytime, claim after epoch ends.
                        </InfoCard>
                        <InfoCard title="Premium" status="Day 0">
                            Collected at epoch start after RFQ completes.
                        </InfoCard>
                        <InfoCard title="Settlement" status="Day 7">
                            Options settle, yield distributed to depositors.
                        </InfoCard>
                    </div>
                </AccordionSection>

                <AccordionSection
                    id="risks"
                    title="Risk Profile"
                    icon={<Shield className="w-5 h-5" />}
                    isOpen={openSection === "risks"}
                    onToggle={() => setOpenSection(openSection === "risks" ? null : "risks")}
                >
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                        <p className="text-yellow-300 text-sm">
                            <strong>Important:</strong> Covered call strategies involve risk. Understand these risks before depositing.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <RiskCard
                            title="1. Upside Cap Risk"
                            severity="Medium"
                            description="If the underlying rises above the strike price, you miss gains beyond that level. With 10% OTM strikes, you still capture up to 10% upside."
                        />
                        <RiskCard
                            title="2. Downside Risk"
                            severity="Unchanged"
                            description="If the underlying drops, your tokens lose value. The premium provides a small buffer, but doesn't protect against large drops."
                        />
                        <RiskCard
                            title="3. Liquidity Risk"
                            severity="Low"
                            description="Withdrawals are only available at epoch end (every 7 days). You cannot exit mid-epoch."
                        />
                        <RiskCard
                            title="4. Smart Contract Risk"
                            severity="Low"
                            description="Bugs in the protocol could result in loss of funds. Code is open-source and audited."
                        />
                    </div>
                </AccordionSection>

                <AccordionSection
                    id="rfq"
                    title="RFQ System"
                    icon={<Users className="w-5 h-5" />}
                    isOpen={openSection === "rfq"}
                    onToggle={() => setOpenSection(openSection === "rfq" ? null : "rfq")}
                >
                    <p className="text-gray-400 mb-6">
                        The Request-for-Quote (RFQ) system enables institutional-grade option pricing through
                        competitive market maker quotes.
                    </p>

                    <div className="bg-gray-800/50 rounded-xl p-6 font-mono text-sm mb-6">
                        <div className="space-y-2 text-gray-300">
                            <p><span className="text-blue-400">1.</span> Vault broadcasts RFQ with strike, expiry, size</p>
                            <p><span className="text-blue-400">2.</span> Market makers connect via WebSocket</p>
                            <p><span className="text-blue-400">3.</span> Quotes submitted with premium offers</p>
                            <p><span className="text-blue-400">4.</span> Best quote (highest premium) selected</p>
                            <p><span className="text-blue-400">5.</span> Trade executed on-chain</p>
                        </div>
                    </div>

                    <p className="text-gray-400">
                        This approach ensures competitive pricing and connects DeFi vaults with professional
                        options market makers.
                    </p>
                </AccordionSection>

                <AccordionSection
                    id="tech"
                    title="Technical Architecture"
                    icon={<Code className="w-5 h-5" />}
                    isOpen={openSection === "tech"}
                    onToggle={() => setOpenSection(openSection === "tech" ? null : "tech")}
                >
                    <div className="mb-6">
                        <h4 className="text-white font-semibold mb-3">Smart Contracts</h4>
                        <div className="bg-gray-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="border-b border-gray-700">
                                        <td className="p-3 text-gray-400">Vault</td>
                                        <td className="p-3 font-mono text-xs text-gray-300">8gJH...NuPY</td>
                                        <td className="p-3 text-gray-400">Deposits, withdrawals, share minting</td>
                                    </tr>
                                    <tr className="border-b border-gray-700">
                                        <td className="p-3 text-gray-400">RFQ</td>
                                        <td className="p-3 font-mono text-xs text-gray-300">3M2K...DT5Z</td>
                                        <td className="p-3 text-gray-400">Quote settlement, maker registry</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 text-gray-400">Oracle</td>
                                        <td className="p-3 font-mono text-xs text-gray-300">Pyth Network</td>
                                        <td className="p-3 text-gray-400">Real-time NVDA price feeds</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-3">Tech Stack</h4>
                        <div className="flex flex-wrap gap-2">
                            {["Solana", "Anchor", "Pyth", "Next.js", "TypeScript", "WebSocket"].map((tech) => (
                                <span
                                    key={tech}
                                    className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm"
                                >
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </div>
                </AccordionSection>
            </div>

            {/* CTA */}
            <div className="mt-8 p-4 bg-gradient-to-r from-green-500/5 to-blue-500/5 rounded-xl border border-gray-700/50 text-center">
                <h3 className="text-xl font-bold text-white mb-2">Ready to Start Earning?</h3>
                <p className="text-gray-400 mb-4">Deposit your xStock tokens and earn yield from covered call premiums.</p>
                <Link
                    href="/v2/earn/nvdax"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-xl transition-colors"
                >
                    Go to NVDAx Vault
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}

// Helper Components

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3 text-center">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-white">{value}</p>
        </div>
    );
}

function AccordionSection({
    id, title, icon, children, isOpen, onToggle
}: {
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border border-gray-700/50 rounded-xl overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-green-400">{icon}</span>
                    <span className="text-lg font-semibold text-white">{title}</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 bg-gray-900/30">
                    {children}
                </div>
            )}
        </div>
    );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-1">{title}</h4>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">{title}</h4>
                <div className="text-sm text-gray-400">{children}</div>
            </div>
        </div>
    );
}

function InfoCard({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
    return (
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-white">{title}</h4>
                <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">{status}</span>
            </div>
            <p className="text-sm text-gray-400">{children}</p>
        </div>
    );
}

function RiskCard({ title, severity, description }: { title: string; severity: string; description: string }) {
    const severityColors = {
        Low: "text-green-400 bg-green-500/20",
        Medium: "text-yellow-400 bg-yellow-500/20",
        High: "text-red-400 bg-red-500/20",
        Unchanged: "text-gray-400 bg-gray-500/20",
    };

    return (
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-white">{title}</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${severityColors[severity as keyof typeof severityColors]}`}>
                    {severity}
                </span>
            </div>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}
