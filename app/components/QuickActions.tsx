"use client";

import Link from "next/link";

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  variant: "primary" | "secondary" | "outline";
}

// const quickActions: QuickAction[] = [
//   {
//     label: "Trade NVDAx Options",
//     href: "/stock",
//     variant: "primary",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
//       </svg>
//     ),
//   },
//   {
//     label: "View My Portfolio",
//     href: "/portfolio",
//     variant: "secondary",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
//         <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
//       </svg>
//     ),
//   },
//   {
//     label: "Set Price Alerts",
//     href: "/alerts",
//     variant: "outline",
//     icon: (
//       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//         <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
//         <path d="M13.73 21a2 2 0 01-3.46 0" />
//       </svg>
//     ),
//   },
// ];

// export default function QuickActions() {
//   return (
//     <div className="bg-secondary/30 border border-border rounded-xl p-4">
//       <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
//         <div className="flex items-center gap-2 text-muted-foreground">
//         </div>
        
//         <div className="flex flex-wrap gap-3">
//           {quickActions.map((action) => (
//             <Link
//               key={action.label}
//               href={action.href}
//               className={`
//                 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
//                 transition-all hover:scale-105 active:scale-95
//                 ${
//                   action.variant === "primary"
//                     ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
//                     : action.variant === "secondary"
//                       ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
//                       : "bg-transparent border border-border hover:border-muted-foreground/50 text-foreground"
//                 }
//               `}
//             >
//               {action.icon}
//               {action.label}
//             </Link>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }
