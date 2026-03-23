"use client";

import React, { createContext, useContext, useState } from "react";
import GlobalLoader from "@/components/GlobalLoader";

interface GlobalLoadingContextType {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextType | undefined>(undefined);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <GlobalLoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {isLoading && <GlobalLoader fullScreen={true} />}
      {children}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);
  if (context === undefined) {
    throw new Error("useGlobalLoading must be used within a GlobalLoadingProvider");
  }
  return context;
}
