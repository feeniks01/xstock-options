"use client";

import Link from "next/link";
import { Info, ArrowRight } from "lucide-react";

interface Update {
  text: string;
  isNew?: boolean;
}

const updates: Update[] = [
  { text: "NVDAx options now live", isNew: true },
  { text: "New expirations added (15m, 1h)", isNew: true },
  { text: "More stocks coming this week" },
  { text: "Improved order execution speed" },
];

export default function WhatsNew() {
  return (
    <div className="bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Info className="w-[18px] h-[18px] text-blue-400" />
        </div>
        <h3 className="font-semibold text-foreground">Latest Updates</h3>
      </div>

      <ul className="space-y-3 mb-4">
        {updates.map((update, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
            <span className="text-muted-foreground flex-1">{update.text}</span>
            {update.isNew && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                NEW
              </span>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/changelog"
        className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        View full changelog
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
