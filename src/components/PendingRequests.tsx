"use client";

import { useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useChatStore } from "@/store/useChatStore";
import UserAvatar from "@/components/UserAvatar";

export default function PendingRequests() {
  const supabase = createClient();

  const {
    pendingRequests: requests,
    isRequestsLoading,
    optimisticAcceptRequest,
    optimisticDeclineRequest,
  } = useChatStore();

  const [, startTransition] = useTransition();
  const prevCountRef = useRef<number>(0);

  // Play sound if the number of requests increased since last render
  useEffect(() => {
    if (requests.length > prevCountRef.current && prevCountRef.current !== 0) {
      try {
        const audio = new Audio("/dragon-studio-notification-sound-effect-372475.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => { /* Autoplay blocked — ignore silently */ });
      } catch {
        // Audio playback not supported — ignore
      }
    }
    prevCountRef.current = requests.length;
  }, [requests.length]);

  /** Accept a connection request optimistically */
  const handleAccept = async (connectionId: string) => {
    startTransition(() => {
      optimisticAcceptRequest(connectionId);
    });

    await supabase
      .from("connections")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", connectionId);
  };

  /** Decline (delete) a connection request optimistically */
  const handleDecline = async (connectionId: string) => {
    startTransition(() => {
      optimisticDeclineRequest(connectionId);
    });

    await supabase.from("connections").delete().eq("id", connectionId);
  };

  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  if (isRequestsLoading && requests.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Pending Requests</h2>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Pending Requests
        {requests.length > 0 && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium">
            {requests.length}
          </span>
        )}
      </h2>

      {requests.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: colors.textTertiary }}>No pending requests</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: colors.surfaceHover }}
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={req.profile.name}
                  avatarUrl={req.profile.avatar_url}
                  size={40}
                  textClassName="text-sm"
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: colors.textPrimary }}>{req.profile.name}</p>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>@{req.profile.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(req.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(req.id)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.textSecondary }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
