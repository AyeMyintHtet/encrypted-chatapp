"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthStore } from "@/store/useAuthStore";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAuthStore((state) => state.theme_mode);
  const setThemeMode = useAuthStore((state) => state.setThemeMode);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to access current theme and toggle function */
export function useTheme() {
  return useContext(ThemeContext);
}
