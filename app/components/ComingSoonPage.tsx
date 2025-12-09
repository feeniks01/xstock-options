"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Mail, Loader2, Check } from "lucide-react";

/**
 * Coming Soon Landing Page Component
 * 
 * Features:
 * - Centered hero section with description
 * - Email capture form with validation
 * - Loading and success/error states
 * - Responsive design with orange and white color scheme
 * - Subtle gradients and neon accents
 */
export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }

      // Success
      setIsSuccess(true);
      setEmail("");
      toast.success("Successfully subscribed! We'll notify you when we launch.");
      
      // Reset success state after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to subscribe. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effects - orange theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-orange-600/5 to-orange-500/5" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.1),transparent_50%)]" />

      {/* Animated particles/glow effects - orange */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto text-center">
        {/* Project name */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-white">
          optionsfi
        </h1>

        {/* Description */}
        <p className="text-xl md:text-2xl text-muted-foreground mb-12">
          Options on tokenized equities
        </p>

        {/* Email capture form */}
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-2 focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                <Mail className="w-5 h-5 text-muted-foreground ml-2 flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isSubmitting || isSuccess}
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                  required
                />
                {isSuccess && (
                  <Check className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0" />
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isSuccess || !email.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-orange-500/25 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Subscribing...</span>
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Subscribed!</span>
                </>
              ) : (
                <span>Notify Me</span>
              )}
            </button>
          </form>

          {/* Helper text */}
          <p className="mt-4 text-sm text-muted-foreground">
            Be the first to know when we launch
          </p>
        </div>
      </div>
    </div>
  );
}
