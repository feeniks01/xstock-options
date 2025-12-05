"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    const particleCount = 60;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.2,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.05)");
      gradient.addColorStop(0.5, "rgba(147, 51, 234, 0.03)");
      gradient.addColorStop(1, "rgba(59, 130, 246, 0.05)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${particle.opacity})`;
        ctx.fill();

        // Draw connections
        particlesRef.current.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(147, 51, 234, ${0.15 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full min-h-[50vh] flex items-center justify-center overflow-hidden border-b border-border">
      {/* Animated Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.8 }}
      />

      {/* Floating Stock Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-icon absolute top-[15%] left-[10%] opacity-20 animate-float-slow">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
            <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
        </div>
        <div className="floating-icon absolute top-[25%] right-[15%] opacity-15 animate-float-medium">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" />
          </svg>
        </div>
        <div className="floating-icon absolute bottom-[20%] left-[20%] opacity-15 animate-float-fast">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-400">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </div>
        <div className="floating-icon absolute bottom-[30%] right-[10%] opacity-20 animate-float-slow">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-300">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
          Trade options on real-world stocks — fully on-chain.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Fast, permissionless, cash-settled.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/stock"
            className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Start Trading
          </Link>
          <a
            href="#markets"
            className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold px-8 py-3 rounded-lg border border-border transition-all hover:scale-105"
          >
            Learn More
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </a>
        </div>
      </div>

      {/* CSS for floating animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 6s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
