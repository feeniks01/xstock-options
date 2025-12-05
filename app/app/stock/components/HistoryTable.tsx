"use client";

interface HistoryTableProps {
    positions: any[];
    walletPublicKey: string;
}

export default function HistoryTable({ positions, walletPublicKey }: HistoryTableProps) {
    if (positions.length === 0) {
        return (
            <div className="text-center py-16 bg-[#0f1015] rounded-xl border border-[#27272a]">
                <p className="text-[#f5f5f5] text-lg mb-2">No trade history yet</p>
                <p className="text-[rgba(255,255,255,0.5)] text-sm">Your completed trades will appear here.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#0f1015]">
            <table className="w-full text-sm text-left">
                <thead className="bg-[#131722] text-[rgba(255,255,255,0.5)] uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Strike</th>
                        <th className="px-6 py-4">Contracts</th>
                        <th className="px-6 py-4">Cost</th>
                        <th className="px-6 py-4">PnL</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Expiry</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                    {positions.map((pos) => {
                        const isSeller = pos.account.seller.toString() === walletPublicKey;
                        const strike = pos.account.strike.toNumber() / 100_000_000;
                        const premiumPerShare = pos.account.premium.toNumber() / 1_000_000;
                        const contracts = pos.account.amount 
                            ? pos.account.amount.toNumber() / (100 * 1_000_000)
                            : 1;
                        // Total premium = per-share × 100 shares × contracts
                        const totalPremium = premiumPerShare * 100 * contracts;
                        const expiry = new Date(pos.account.expiryTs.toNumber() * 1000);
                        const isExercised = pos.account.exercised;
                        const buyerExercised = pos.account.buyerExercised;
                        const isExpired = new Date() > expiry;

                        // Determine Status/Result & PnL
                        let status = "Open";
                        let pnlClass = "text-muted-foreground";
                        let pnlText = "—";

                        if (isSeller) {
                            // Seller Logic - they receive premium
                            if (isExercised) {
                                if (buyerExercised) {
                                    status = "Assigned";
                                    pnlText = `+$${totalPremium.toFixed(2)}`;
                                    pnlClass = "text-green-500";
                                } else {
                                    status = "Reclaimed";
                                    pnlText = `+$${totalPremium.toFixed(2)}`;
                                    pnlClass = "text-green-500";
                                }
                            } else if (isExpired) {
                                status = "Expired (Claimable)";
                                pnlText = `+$${totalPremium.toFixed(2)}`;
                                pnlClass = "text-yellow-500";
                            } else {
                                status = "Open";
                                pnlText = "—";
                                pnlClass = "text-muted-foreground";
                            }
                        } else {
                            // Buyer Logic - they pay premium
                            if (isExercised) {
                                if (buyerExercised) {
                                    status = "Exercised";
                                    pnlText = "Settled";
                                    pnlClass = "text-green-500";
                                } else {
                                    // Seller Reclaimed = Expired for Buyer
                                    status = "Expired";
                                    pnlText = `-$${totalPremium.toFixed(2)}`;
                                    pnlClass = "text-red-500";
                                }
                            } else if (isExpired) {
                                status = "Expired";
                                pnlText = `-$${totalPremium.toFixed(2)}`;
                                pnlClass = "text-red-500";
                            } else {
                                status = "Open";
                                pnlText = "—";
                                pnlClass = "text-blue-400";
                            }
                        }

                        return (
                            <tr key={pos.publicKey.toString()} className="hover:bg-[#1a1b20] transition-colors">
                                <td className="px-6 py-4 font-medium">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isSeller ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {isSeller ? 'SELL' : 'BUY'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-[#f5f5f5]">${strike.toFixed(2)}</td>
                                <td className="px-6 py-4 text-[#f5f5f5]">{contracts.toFixed(2)}</td>
                                <td className="px-6 py-4 text-[#f5f5f5]">${totalPremium.toFixed(2)}</td>
                                <td className={`px-6 py-4 font-medium ${pnlClass}`}>
                                    {pnlText}
                                </td>
                                <td className="px-6 py-4 text-[rgba(255,255,255,0.5)]">
                                    {status}
                                </td>
                                <td className="px-6 py-4 text-[rgba(255,255,255,0.5)]">
                                    {expiry.toLocaleDateString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
