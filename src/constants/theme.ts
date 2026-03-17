/**
 * Centralized theme configuration for the application.
 * Defines colors for both dark and light (white) modes.
 */
export const THEME_CONFIG = {
  dark: {
    background: "linear-gradient(to bottom right, #030712, #111827, #030712)",
    backgroundSolid: "#030712",
    surface: "rgba(255, 255, 255, 0.05)",
    surfaceHover: "rgba(255, 255, 255, 0.1)",
    border: "rgba(255, 255, 255, 0.1)",
    borderMuted: "rgba(255, 255, 255, 0.05)",
    textPrimary: "#FFFFFF",
    textSecondary: "#9CA3AF", // gray-400
    textTertiary: "#6B7280",  // gray-500
    inputBg: "rgba(255, 255, 255, 0.05)",
    accent: "#09637E",
    accentSecondary: "#088395",
    glow1: "rgba(9, 99, 126, 0.15)",
    glow2: "rgba(6, 182, 212, 0.15)",
  },
  light: {
    background: "#F9F8F6",
    backgroundSolid: "#F9F8F6",
    surface: "#EFE9E3",
    surfaceHover: "#D9CFC7",
    border: "#D9CFC7",
    borderMuted: "#E5DCD3",
    textPrimary: "#1A1A1A",
    textSecondary: "#8B7D6B",
    textTertiary: "#C9B59C",
    inputBg: "#FFFFFF",
    accent: "#09637E",
    accentSecondary: "#088395",
    glow1: "rgba(9, 99, 126, 0.08)",
    glow2: "rgba(8, 131, 149, 0.08)",
  },
} as const;

export type ThemeType = "dark" | "light";
export type ThemeColors = typeof THEME_CONFIG.dark;
