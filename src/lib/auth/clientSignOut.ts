"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { clearAllClientData } from "@/store/clearAllData";

function clearBrowserCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.trim().split("=")[0];
    if (!name) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

export async function clearClientSessionData(queryClient?: QueryClient) {
  queryClient?.clear();

  if (typeof window === "undefined") return;

  await clearAllClientData();
  clearBrowserCookies();
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
