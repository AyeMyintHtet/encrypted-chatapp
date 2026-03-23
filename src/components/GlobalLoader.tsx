"use client";

import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";

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
        {/* Outer glowing ring */}
        <div 
          className="absolute w-16 h-16 rounded-full animate-spin border-4 border-solid border-t-transparent border-l-transparent border-r-transparent" 
          style={{ borderColor: `${colors.accent}40`, borderTopColor: colors.accent, borderRightColor: colors.accent }} 
        />
        {/* Inner pulsing circle */}
        <div 
          className="w-10 h-10 rounded-full animate-pulse shadow-[0_0_15px_rgba(9,99,126,0.5)]" 
          style={{ background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentSecondary})` }}
        />
      </div>
      <p className="mt-8 font-bold tracking-[0.2em] uppercase text-xs animate-pulse" style={{ color: colors.textSecondary }}>
        Loading
      </p>
    </div>
  );
}
