"use client";

import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import LoadingSpinner from "./LoadingSpinner";

export default function GlobalLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  const { theme } = useTheme();
  // Safe fallback if called before theme hydration
  const colors = THEME_CONFIG[(theme as ThemeType) || "dark"];

  return (
    <div 
      className={`flex flex-col items-center justify-center z-50 transition-opacity duration-300 ${fullScreen ? 'fixed inset-0' : 'w-full h-full min-h-[50vh]'}`}
      style={{ background: fullScreen ? colors.backgroundSolid : 'transparent' }}
    >
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring using the standard component with exact size match */}
        <LoadingSpinner size="xl" />
        {/* Inner pulsing circle - keeping this for the unique branded look */}
        <div 
          className="absolute w-10 h-10 rounded-full animate-pulse shadow-[0_0_15px_rgba(9,99,126,0.5)]" 
          style={{ background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentSecondary})` }}
        />
      </div>
      <p className="mt-8 font-bold tracking-[0.2em] uppercase text-xs animate-pulse" style={{ color: colors.textSecondary }}>
        Loading
      </p>
    </div>
  );
}
