"use client";

import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: string;
}

export default function LoadingSpinner({ 
  size = "md", 
  className = "",
  color 
}: LoadingSpinnerProps) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[(theme as ThemeType) || "dark"];
  
  const sizeClasses = {
    xs: "h-3 w-3 border-2",
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-[3px]",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-4"
  };

  return (
    <div className={`relative animate-spin ${sizeClasses[size]} rounded-full ${className}`}
      style={{ 
        borderColor: `${color || colors.accent}40`, 
        borderTopColor: color || colors.accent 
      }}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
