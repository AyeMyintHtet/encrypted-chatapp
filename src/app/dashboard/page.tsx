"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/hooks/usePresence";
import SearchUsers from "@/components/SearchUsers";
import PendingRequests from "@/components/PendingRequests";
import ContactsList from "@/components/ContactsList";
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

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-xl flex items-center justify-center shadow-lg shadow-[#09637E]/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">ChatApp</h1>
              <p className="text-gray-500 text-xs">Encrypted P2P Messaging</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User info with status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <div className="relative">
                <div className="w-7 h-7 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                {/* <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${statusColor}`} /> */}
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium">{profile.name}</p>
                {/* <p className="text-gray-500 text-xs">{statusLabel}</p> */}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer"
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
