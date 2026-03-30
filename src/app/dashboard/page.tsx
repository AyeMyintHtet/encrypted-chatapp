"use client";

import { useMemo, useState } from "react";
import { LazyMotion, domMax, m, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";


import { usePresence } from "@/hooks/usePresence";
import { useConnectionsSync } from "@/hooks/useConnectionsSync";
import { usePendingMessages } from "@/hooks/usePendingMessages";
import { useCurrentProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import ContactsList from "@/components/ContactsList";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useChatStore } from "@/store/useChatStore";
import { Home, Search, User } from "lucide-react";
import ProfileComponent from "@/components/profile/profileComponent";
import SignOutModal from "@/components/SignOut";
import Header from "@/components/Header";

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

const OneTimeChat = dynamic(() => import("@/components/OneTimeChat"), {
  loading: () => (
    <div className="animate-pulse rounded-2xl h-30" style={{ background: "rgba(9,99,126,0.08)" }} />
  ),
});

const ChatAccessError = dynamic(() => import("@/components/ChatAccessError"), {
  ssr: false,
});


/**
 * Dashboard — the main hub after login.
 * Shows search, pending requests, and contacts with presence tracking.
 */
export default function DashboardPage() {


  // Fetch current user's profile using centralized React Query hook
  const { data: profile, isLoading: loading } = useCurrentProfile();
  const contacts = useChatStore((state) => state.contacts);
  const watchedUserIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);

  // Centralized, filtered realtime sync for contacts + pending requests.
  useConnectionsSync(profile?.id ?? "");

  // Fetch and decrypt any pending (offline) messages from Supabase on page load.
  // Shows GlobalLoader while processing.
  usePendingMessages(profile?.id ?? "");

  // Initialize presence tracking — no chatWith, so our status is "offline" here
  const { presenceMap } = usePresence(
    profile?.id ?? "",
    profile?.username ?? "",
    undefined,
    watchedUserIds
    // No chatWith = we're on dashboard, so status = "offline"
  );

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
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <LazyMotion features={domMax}>
      <div className="" style={{ background: colors.background }}>
        {/* Ambient background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow1 }} />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-[120px]" style={{ background: colors.glow2 }} />
        </div>

        {/* Top bar */}
        <Header profile={profile} setShowSignOutConfirm={setShowSignOutConfirm} />

        {/* Main content */}
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8 min-h-screen">
          {/* Desktop View (Grid) */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-6">
            <div className="lg:col-span-1 md:col-span-1 space-y-6">
              <SearchUsers currentUserId={profile.id} />
              <PendingRequests />
              <OneTimeChat />
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
                  <OneTimeChat />
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
                  <ProfileComponent setShowSignOutConfirm={setShowSignOutConfirm} />
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
                  onClick={() => [setActiveTab(id), window.scrollTo(0, 0)]}
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

        <SignOutModal showSignOutConfirm={showSignOutConfirm} setShowSignOutConfirm={setShowSignOutConfirm} />
        <ChatAccessError />
      </div>
    </LazyMotion>
  );
}
