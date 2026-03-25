"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store/useAppStore";

const PRESERVED_LOCAL_STORAGE_KEYS = ["chatapp-theme"] as const;

function clearBrowserCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.trim().split("=")[0];
    if (!name) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

function preserveLocalStorageValues() {
  const preserved = new Map<string, string>();
  for (const key of PRESERVED_LOCAL_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      preserved.set(key, value);
    }
  }
  return preserved;
}



export async function clearClientSessionData(queryClient?: QueryClient) {
  queryClient?.clear();

  useAppStore.getState().clearStore();
  useAppStore.persist.clearStorage();

  if (typeof window === "undefined") return;

  clearBrowserCookies();

  const preserved = preserveLocalStorageValues();
  localStorage.clear();
  sessionStorage.clear();
  preserved.forEach((value, key) => localStorage.setItem(key, value));

}

export async function signOutAndClearClientState(queryClient?: QueryClient) {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error(error);
  } finally {
    await clearClientSessionData(queryClient);
  }
}
