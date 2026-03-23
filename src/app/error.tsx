"use client";

import { useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { theme } = useTheme();
  // Safe fallback if called before theme hydration
  const colors = THEME_CONFIG[(theme as ThemeType) || "dark"];

  useEffect(() => {
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
      style={{ background: colors.backgroundSolid }}
    >
      <div 
        className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl mb-6 relative overflow-hidden"
        style={{ background: colors.surfaceHover, border: `1px solid ${colors.border}` }}
      >
        <div className="absolute inset-0 bg-red-500/10" />
        <AlertTriangle size={36} className="text-red-500 relative z-10" strokeWidth={2.5} />
      </div>
      
      <h1 className="text-3xl font-bold mb-3 tracking-tight" style={{ color: colors.textPrimary }}>
        Something went wrong.
      </h1>
      
      <p className="max-w-md mb-8 text-[15px] leading-relaxed" style={{ color: colors.textTertiary }}>
        A critical error occurred while trying to render this page or component.
      </p>

      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
        style={{ background: colors.accent, color: '#FFF' }}
      >
        <RotateCcw size={18} strokeWidth={2.5} />
        Try again
      </button>

      {/* Development only details */}
      {process.env.NODE_ENV === "development" && (
        <div 
          className="mt-12 p-5 rounded-xl w-full max-w-2xl text-left overflow-auto text-xs font-mono border"
          style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)', color: colors.textSecondary }}
        >
          <p className="font-bold text-red-500 mb-2">Error Details (Dev Only):</p>
          <p className="mb-1">{error.message}</p>
          {error.digest && <p className="opacity-60 mt-2">Digest: {error.digest}</p>}
        </div>
      )}
    </div>
  );
}
