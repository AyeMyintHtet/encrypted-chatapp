"use client";

import { useMemo, useState } from "react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

import { useRouter } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";
import { useConnectionsSync } from "@/hooks/useConnectionsSync";
import { useCurrentProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import ContactsList from "@/components/ContactsList";
import ThemeToggle from "@/components/ThemeToggle";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";
import { Home, Search, User } from "lucide-react";
import Image from "next/image";

/**
 * Lazy-loaded components — split into separate JS chunks.
 *
 * SearchUsers & PendingRequests: On mobile, these are behind the "search"
 * tab and not visible on initial render. On desktop they're visible, but
 * loading them ~100ms later is imperceptible to users.
 *
 * ConfirmationModal: Only rendered when user clicks "Sign Out" — no reason
 * to include it in the initial bundle at all.
 */
const SearchUsers = dynamic(() => import("@/components/SearchUsers"), {
  loading: () => (
    <div className="animate-pulse rounded-2xl h-30" style={{ background: "rgba(9,99,126,0.08)" }} />
  ),
});

const PendingRequests = dynamic(() => import("@/components/PendingRequests"), {
  loading: () => (
    <div className="animate-pulse rounded-2xl h-25" style={{ background: "rgba(9,99,126,0.08)" }} />
  ),
});

// No SSR needed for modals — they're always triggered by client interaction
const ConfirmationModal = dynamic(() => import("@/components/ConfirmationModal"));

/**
 * Dashboard — the main hub after login.
 * Shows search, pending requests, and contacts with presence tracking.
 */
export default function DashboardPage() {
  const router = useRouter();

  // Fetch current user's profile using centralized React Query hook
  const { data: profile, isLoading: loading } = useCurrentProfile();
  const contacts = useAppStore((state) => state.contacts);
  const watchedUserIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);

  // Centralized, filtered realtime sync for contacts + pending requests.
  useConnectionsSync(profile?.id ?? "");

  // Initialize presence tracking — no chatWith, so our status is "offline" here
  const { presenceMap } = usePresence(
    profile?.id ?? "",
    profile?.username ?? "",
    undefined,
    watchedUserIds
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
  const [[activeTab, direction], setActiveTabState] = useState<["home" | "search" | "profile", number]>(["home", 0]);

  const tabSequence = ["home", "search", "profile"];

  const setActiveTab = (newTab: "home" | "search" | "profile") => {
    const currentIndex = tabSequence.indexOf(activeTab);
    const newIndex = tabSequence.indexOf(newTab);
    if (newIndex === currentIndex) return;
    setActiveTabState([newTab, newIndex > currentIndex ? 1 : -1]);
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.98,
    })
  };

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

  return (
    <LazyMotion features={domAnimation}>
      <div className="" style={{ background: colors.background }}>
        {/* Ambient background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow1 }} />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow2 }} />
        </div>

        {/* Top bar */}
        <header className="relative z-10" style={{ borderBottom: `1px solid ${colors.borderMuted}` }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/logoo.png"
                width={100}
                height={100}
                alt="Logo"
                className="-ml-5"
                priority
                fetchPriority="high"
              />
              <div className="-ml-5">
                <h1 className="font-bold text-lg" style={{ color: colors.textPrimary }}>CQgram</h1>
                <p style={{ color: colors.textTertiary }} className="text-xs hidden sm:block">Encrypted P2P Messaging</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* User info with status */}
              <div className="hidden md:flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                <div className="relative">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="">
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
                aria-label="Sign out"
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
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8 min-h-screen">
          {/* Desktop View (Grid) */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-6">
            <div className="lg:col-span-1 md:col-span-1 space-y-6">
              <SearchUsers currentUserId={profile.id} />
              <PendingRequests />
            </div>
            <div className="lg:col-span-2 md:col-span-1 col-span-1">
              <ContactsList currentUserId={profile.id} presenceMap={presenceMap} />
            </div>
          </div>

          {/* Mobile View (Tabbed) */}
          <div className="block md:hidden pb-20 relative overflow-x-hidden safe-bottom-area">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              {activeTab === "home" && (
                <m.div
                  key="home"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-full"
                >
                  <ContactsList currentUserId={profile.id} presenceMap={presenceMap} />
                </m.div>
              )}
              {activeTab === "search" && (
                <m.div
                  key="search"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-6 w-full"
                >
                  <SearchUsers currentUserId={profile.id} />
                  <PendingRequests />
                </m.div>
              )}

              {activeTab === "profile" && (
                <m.div
                  key="profile"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-full"
                >
                  <div
                    className="rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 relative z-10"
                    style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                  >
                    <div className="w-20 h-20 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-3xl font-bold">{profile.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{profile.name}</h2>
                      <p style={{ color: colors.textTertiary }}>@{profile.username}</p>
                    </div>
                    <button
                      onClick={() => setShowSignOutConfirm(true)}
                      className="cursor-pointer mt-4 px-6 py-2 rounded-full font-medium transition-colors border w-full text-center"
                      style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                    >
                      Sign Out
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Floating Glassmorphism Bottom Navigation Bar */}
        <footer className="fixed bottom-6 inset-x-0 z-50 md:hidden flex justify-center pointer-events-none pb-safe">
          <div
            className="pointer-events-auto flex items-center justify-center gap-6 px-8 py-3 rounded-full border-t shadow-2xl"
            style={{
              background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px) saturate(150%)',
              WebkitBackdropFilter: 'blur(16px) saturate(150%)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
            }}
          >
            {([
              { id: "home", icon: Home },
              { id: "search", icon: Search },
              { id: "profile", icon: User }
            ] as const).map(({ id, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  aria-label={id}
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="relative flex flex-col items-center justify-center w-12 h-12"
                >
                  {/* Active Indicator Background */}
                  {isActive && (
                    <m.div
                      layoutId="active-nav-bg"
                      className={`absolute rounded-full ${isDark ? 'bg-white' : 'bg-black'} z-0 w-10 h-10`}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}

                  {/* Icon */}
                  <Icon
                    className={`relative z-10 w-6 h-6 transition-colors duration-200 ${isActive
                      ? (isDark ? 'text-black' : 'text-white')
                      : 'text-gray-400'
                      }`}
                    strokeWidth={2}
                  />

                  {/* Blue Dot */}
                  <div className="absolute -bottom-[2px] w-1 h-1 flex items-center justify-center">
                    {isActive && (
                      <m.div
                        layoutId="active-nav-dot"
                        className="w-1 h-1 bg-blue-500 rounded-full"
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </footer>

        <ConfirmationModal
          isOpen={showSignOutConfirm}
          onClose={() => setShowSignOutConfirm(false)}
          onConfirm={handleSignOut}
          title="Sign Out"
          message="Are you sure you want to sign out from your account?"
          confirmText="Sign Out"
        />
      </div>
    </LazyMotion>
  );
}
