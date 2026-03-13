"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/hooks/usePresence";
import { useTheme } from "@/context/ThemeContext";
import SearchUsers from "@/components/SearchUsers";
import PendingRequests from "@/components/PendingRequests";
import ContactsList from "@/components/ContactsList";
import ThemeToggle from "@/components/ThemeToggle";
import type { Profile } from "@/lib/types";

/**
 * Dashboard — the main hub after login.
 * Shows search, pending requests, and contacts with presence tracking.
 */
export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user's profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // 406 = session invalid/expired — sign out, clear cookies, redirect to login
      if (error && (error.code === "406" || error.message?.includes("406"))) {
        await supabase.auth.signOut();
        // Clear all Supabase auth cookies to fully reset session
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
        router.push("/login");
        return;
      }

      if (data) setProfile(data);
      setLoading(false);
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize presence tracking — no chatWith, so our status is "offline" here
  const { presenceMap, myStatus } = usePresence(
    profile?.id ?? "",
    profile?.username ?? ""
    // No chatWith = we're on dashboard, so status = "offline"
  );

  /** Sign out and redirect to login */
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? "linear-gradient(to bottom right, #030712, #111827, #030712)" : "#F9F8F6" }}>
        <svg className="animate-spin h-8 w-8 text-[#09637E]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!profile) return null;

  /** Get status color for own status indicator */
  const statusColor =
    myStatus === "active" ? "bg-emerald-500" :
      myStatus === "idle" ? "bg-amber-500" : "bg-gray-500";

  const statusLabel =
    myStatus === "active" ? "Active" :
      myStatus === "idle" ? "Idle" : "Offline";

  return (
    <div className="min-h-screen" style={{ background: isDark ? "linear-gradient(to bottom right, #030712, #111827, #030712)" : "#F9F8F6" }}>
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: isDark ? "rgba(9,99,126,0.1)" : "rgba(9,99,126,0.06)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: isDark ? "rgba(6,182,212,0.1)" : "rgba(8,131,149,0.06)" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10" style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #D9CFC7" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-xl flex items-center justify-center shadow-lg shadow-[#09637E]/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg" style={{ color: isDark ? "#fff" : "#1a1a1a" }}>ChatApp</h1>
              <p style={{ color: isDark ? "#6b7280" : "#C9B59C" }} className="text-xs">Encrypted P2P Messaging</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info with status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#EFE9E3", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #D9CFC7" }}>
              <div className="relative">
                <div className="w-7 h-7 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium" style={{ color: isDark ? "#fff" : "#1a1a1a" }}>{profile.name}</p>
              </div>
            </div>

            <ThemeToggle />

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm rounded-lg transition-all cursor-pointer"
              style={{
                color: isDark ? "#9ca3af" : "#C9B59C",
                background: isDark ? "rgba(255,255,255,0.05)" : "#EFE9E3",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #D9CFC7",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Search + Pending Requests */}
          <div className="lg:col-span-1 space-y-6">
            <SearchUsers currentUserId={profile.id} />
            <PendingRequests currentUserId={profile.id} />
          </div>

          {/* Right column: Contacts */}
          <div className="lg:col-span-2">
            <ContactsList currentUserId={profile.id} presenceMap={presenceMap} />
          </div>
        </div>
      </main>
    </div>
  );
}
