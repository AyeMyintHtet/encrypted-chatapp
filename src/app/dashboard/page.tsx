"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";
import { useCurrentProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import SearchUsers from "@/components/SearchUsers";
import PendingRequests from "@/components/PendingRequests";
import ContactsList from "@/components/ContactsList";
import ThemeToggle from "@/components/ThemeToggle";
import ConfirmationModal from "@/components/ConfirmationModal";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import type { Profile } from "@/lib/types";

/**
 * Dashboard — the main hub after login.
 * Shows search, pending requests, and contacts with presence tracking.
 */
export default function DashboardPage() {
  const router = useRouter();

  // Fetch current user's profile using centralized React Query hook
  const { data: profile, isLoading: loading } = useCurrentProfile();

  // Initialize presence tracking — no chatWith, so our status is "offline" here
  const { presenceMap, myStatus } = usePresence(
    profile?.id ?? "",
    profile?.username ?? ""
    // No chatWith = we're on dashboard, so status = "offline"
  );

  /** Sign out and redirect to login */
  const handleSignOut = async () => {
    // Note: It's better to rely on Supabase directly to log out the user,
    // though createClient could have been kept, we recreate it here specifically for log out.
    // Or we can import explicitly.
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  
  // We reinstate showSignOutConfirm because I deleted the hook inadvertently!
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = THEME_CONFIG[theme as ThemeType];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
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
    <div className="min-h-screen " style={{ background: colors.background }}>
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow1 }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow2 }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10" style={{ borderBottom: `1px solid ${colors.borderMuted}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-xl flex items-center justify-center shadow-lg shadow-[#09637E]/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg" style={{ color: colors.textPrimary }}>Kito</h1>
              <p style={{ color: colors.textTertiary }} className="text-xs hidden sm:block">Encrypted P2P Messaging</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* User info with status */}
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
              <div className="relative">
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{profile.name}</p>
              </div>
            </div>

            <ThemeToggle />

            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              style={{
                color: colors.textSecondary,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 max-h-[80dvh]">
        <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-6">
          {/* Left column: Search + Pending Requests */}
          <div className="lg:col-span-1 md:col-span-1 space-y-6 hidden md:block ">
            <SearchUsers currentUserId={profile.id} />
            <PendingRequests currentUserId={profile.id} />
          </div>

          {/* Right column: Contacts */}
          <div className="lg:col-span-2 md:col-span-1 col-span-1">
            <ContactsList currentUserId={profile.id} presenceMap={presenceMap} />
          </div>
        </div>
      </main>


      <ConfirmationModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out from your account?"
        confirmText="Sign Out"
      />
    </div>
  );
}
