"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ArrowRight } from "lucide-react";

/**
 * Hidden Access Page
 * 
 * This page is not linked from anywhere in the frontend.
 * Users with valid access codes can use this to bypass the waitlist.
 * 
 * URL: /access
 */
export default function AccessPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!accessCode.trim()) {
      setError("Please enter an access code");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessCode: accessCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid access code");
      }

      // Success - redirect to home page
      router.push("/");
      router.refresh(); // Force refresh to pick up new cookie

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify access code";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Early Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your access code to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setError("");
              }}
              placeholder="Enter access code"
              disabled={isSubmitting}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all disabled:opacity-50"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !accessCode.trim()}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
