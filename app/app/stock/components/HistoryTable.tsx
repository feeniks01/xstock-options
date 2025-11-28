"use client";

interface HistoryTableProps {
    positions: any[];
    walletPublicKey: string;
}

export default function HistoryTable({ positions, walletPublicKey }: HistoryTableProps) {
    if (positions.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
                No trade history yet
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs">
                    <tr>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Strike</th>
                        <th className="px-6 py-4">Premium</th>
                        <th className="px-6 py-4">PnL</th>
                        <th className="px-6 py-4">Result</th>
                        <th className="px-6 py-4">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {positions.map((pos) => {
                        const isSeller = pos.account.seller.toString() === walletPublicKey;
                        const strike = pos.account.strike.toNumber() / 1_000_000;
                        const premium = pos.account.premium.toNumber() / 1_000_000;
                        const expiry = new Date(pos.account.expiryTs.toNumber() * 1000);
                        const isExercised = pos.account.exercised;
                        const buyerExercised = pos.account.buyerExercised;

                        // Determine Status/Result & PnL
                        let status = "Unknown";
                        let pnlClass = "text-muted-foreground";
                        let pnlText = "N/A";

                        if (isSeller) {
                            // Seller Logic
                            if (isExercised) {
                                if (buyerExercised) {
                                    status = "Assigned";
                                    pnlText = `+$${premium.toFixed(2)}`;
                                    pnlClass = "text-green-500";
                                } else {
                                    status = "Reclaimed";
                                    pnlText = `+$${premium.toFixed(2)}`;
                                    pnlClass = "text-green-500";
                                }
                            }
                        } else {
                            // Buyer Logic
                            if (isExercised) {
                                if (buyerExercised) {
                                    status = "Exercised";
                                    pnlText = "N/A";
                                    pnlClass = "text-muted-foreground";
                                } else {
                                    // Seller Reclaimed = Expired for Buyer
                                    status = "Expired";
                                    pnlText = `-$${premium.toFixed(2)}`;
                                    pnlClass = "text-red-500";
                                }
                            } else {
                                status = "Expired";
                                pnlText = `-$${premium.toFixed(2)}`;
                                pnlClass = "text-red-500";
                            }
                        }

                        return (
                            <tr key={pos.publicKey.toString()} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-6 py-4 font-medium">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isSeller ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {isSeller ? 'SELL' : 'BUY'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">${strike.toFixed(2)}</td>
                                <td className="px-6 py-4">${premium.toFixed(2)}</td>
                                <td className={`px-6 py-4 font-medium ${pnlClass}`}>
                                    {pnlText}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {status}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
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
