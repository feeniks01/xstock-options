import { cookies } from "next/headers";
import { validateBypassToken } from "../lib/auth";
import ComingSoonPage from "../components/ComingSoonPage";
import Dashboard from "../components/Dashboard";

/**
 * Main Page (Server Component)
 * 
 * Determines whether to show the coming soon page or the dashboard based on:
 * 1. NEXT_PUBLIC_SHOW_COMING_SOON env variable
 * 2. Valid bypass_token cookie (for early access users)
 */
export default async function HomePage() {
  const showComingSoon = process.env.NEXT_PUBLIC_SHOW_COMING_SOON === "true";
  
  // If coming soon mode is not enabled, show dashboard
  if (!showComingSoon) {
    return <Dashboard />;
  }
  
  // Check for valid bypass token in cookies
  const cookieStore = await cookies();
  const bypassToken = cookieStore.get('bypass_token')?.value;
  const hasValidBypass = validateBypassToken(bypassToken);
  
  // If user has valid bypass token, show dashboard
  if (hasValidBypass) {
    return <Dashboard />;
  }
  
  // Otherwise, show coming soon page
  return <ComingSoonPage />;
}
