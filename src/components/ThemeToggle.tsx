"use client";

import { useTheme } from "@/context/ThemeContext";

/**
 * Animated sun/moon theme toggle button.
 * Features a smooth morphing animation between sun (light) and moon (dark) icons
 * with a sliding pill background.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 cursor-pointer overflow-hidden"
      style={{
        background: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "#EFE9E3",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.1)"
          : "1px solid #D9CFC7",
      }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {/* Sun icon — visible in dark mode (click to go light) */}
      <svg
        className="absolute transition-all duration-500 ease-in-out"
        style={{
          width: 20,
          height: 20,
          opacity: isDark ? 1 : 0,
          transform: isDark ? "rotate(0deg) scale(1)" : "rotate(90deg) scale(0)",
          color: "#F9F8F6",
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>

      {/* Moon icon — visible in light mode (click to go dark) */}
      <svg
        className="absolute transition-all duration-500 ease-in-out"
        style={{
          width: 20,
          height: 20,
          opacity: isDark ? 0 : 1,
          transform: isDark ? "rotate(-90deg) scale(0)" : "rotate(0deg) scale(1)",
          color: "#09637E",
        }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>

      {/* Animated glow ring on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          boxShadow: isDark
            ? "inset 0 0 12px rgba(249, 248, 246, 0.15)"
            : "inset 0 0 12px rgba(9, 99, 126, 0.15)",
        }}
      />
    </button>
  );
}
