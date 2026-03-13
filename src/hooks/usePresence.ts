"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PresenceStatus, UserPresence } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

const IDLE_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute of inactivity → idle

/**
 * Custom hook for Supabase Presence.
 *
 * Presence is chat-room-specific:
 * - When `chatWith` is provided → user starts as "active" in that chat room.
 *   After 5 minutes of inactivity, transitions to "idle".
 * - When `chatWith` is NOT provided (e.g., on dashboard) → user is "offline".
 *
 * All users subscribe to a single global presence channel so everyone
 * can see each other's real-time status.
 *
 * @param userId   - Current user's ID
 * @param username - Current user's username
 * @param chatWith - Optional: set to the peer's username when on a chat page.
 *                   Omit or pass empty string on non-chat pages.
 */
export function usePresence(
  userId: string,
  username: string,
  chatWith?: string
) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});

  // Determine initial status based on whether user is in a chat
  const isInChat = Boolean(chatWith);
  const initialStatus: PresenceStatus = isInChat ? "active" : "offline";
  const [myStatus, setMyStatus] = useState<PresenceStatus>(initialStatus);

  // Use a ref to always have the latest status value inside event listeners,
  // avoiding stale closures that prevent "idle" → "active" transitions.
  const myStatusRef = useRef<PresenceStatus>(initialStatus);
  myStatusRef.current = myStatus;

  /** Update our status in the presence channel */
  const trackStatus = useCallback(
    (status: PresenceStatus) => {
      setMyStatus(status);
      myStatusRef.current = status;
      channelRef.current?.track({
        user_id: userId,
        username,
        status,
        // Include who the user is chatting with so peers can know
        chat_with: chatWith ?? "",
        last_seen: new Date().toISOString(),
      });
    },
    [userId, username, chatWith]
  );

  /** Reset the idle timer — only relevant when in a chat */
  const resetIdleTimer = useCallback(() => {
    // Only manage idle/active transitions when in a chat
    if (!isInChat) return;

    // If we were idle, transition back to active (read from ref to avoid stale closure)
    if (myStatusRef.current === "idle") {
      trackStatus("active");
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      trackStatus("idle");
    }, IDLE_TIMEOUT_MS);
  }, [isInChat, trackStatus]);

  useEffect(() => {
    // Don't subscribe if we don't have a userId yet
    if (!userId) return;

    // Subscribe to the global presence channel
    const channel = supabase.channel("presence:global", {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<UserPresence>();
        const map: Record<string, UserPresence> = {};

        // Flatten the presence state into a simple lookup map
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => {
            map[p.user_id] = {
              user_id: p.user_id,
              username: p.username,
              status: p.status,
              last_seen: p.last_seen,
            };
          });
        });

        setPresenceMap(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial status based on context (chat vs. dashboard)
          await channel.track({
            user_id: userId,
            username,
            status: initialStatus,
            chat_with: chatWith ?? "",
            last_seen: new Date().toISOString(),
          });
        }
      });

    // Only set up idle detection when user is in a chat
    if (isInChat) {
      const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
      activityEvents.forEach((event) => {
        window.addEventListener(event, resetIdleTimer, { passive: true });
      });

      // Start the initial idle timer
      idleTimerRef.current = setTimeout(() => {
        trackStatus("idle");
      }, IDLE_TIMEOUT_MS);

      return () => {
        activityEvents.forEach((event) => {
          window.removeEventListener(event, resetIdleTimer);
        });
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        channel.unsubscribe();
      };
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username, chatWith]);

  return { presenceMap, myStatus };
}
