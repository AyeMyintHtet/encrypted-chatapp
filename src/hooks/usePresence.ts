"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PresenceStatus, UserPresence } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

const IDLE_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute of inactivity → idle

function getLatestPresence(
  state: Record<string, UserPresence[]>
): UserPresence | null {
  let latest: UserPresence | null = null;
  let latestTimestamp = -1;

  Object.values(state).forEach((presences) => {
    presences.forEach((presence) => {
      const parsed = Date.parse(presence.last_seen);
      const timestamp = Number.isNaN(parsed) ? 0 : parsed;

      if (timestamp >= latestTimestamp) {
        latestTimestamp = timestamp;
        latest = {
          user_id: presence.user_id,
          username: presence.username,
          status: presence.status,
          last_seen: presence.last_seen,
        };
      }
    });
  });

  return latest;
}

/**
 * Presence hook with scoped fanout:
 * - Tracks the current user on `presence:user:<userId>`
 * - Subscribes only to watched peers (contacts / current chat peer)
 * - Avoids a single global presence channel fanout
 *
 * @param userId         Current user's ID
 * @param username       Current user's username
 * @param chatWith       Optional peer username when in a chat route
 * @param watchUserIds   User IDs we want presence updates for
 */
export function usePresence(
  userId: string,
  username: string,
  chatWith?: string,
  watchUserIds: string[] = []
) {
  const supabase = useMemo(() => createClient(), []);
  const ownChannelRef = useRef<RealtimeChannel | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});

  // Determine initial status based on whether user is in a chat
  const isInChat = Boolean(chatWith);
  const initialStatus: PresenceStatus = isInChat ? "active" : "offline";
  const [myStatus, setMyStatus] = useState<PresenceStatus>(initialStatus);

  // Use a ref to always have the latest status value inside event listeners,
  // avoiding stale closures that prevent "idle" → "active" transitions.
  const myStatusRef = useRef<PresenceStatus>(initialStatus);

  useEffect(() => {
    myStatusRef.current = myStatus;
  }, [myStatus]);

  const watchListSignature = useMemo(() => {
    const filtered = Array.from(
      new Set(watchUserIds.filter((id) => Boolean(id) && id !== userId))
    ).sort();
    return JSON.stringify(filtered);
  }, [userId, watchUserIds]);

  const watchedUserIds = useMemo(
    () => JSON.parse(watchListSignature) as string[],
    [watchListSignature]
  );
  const filteredPresenceMap = useMemo(() => {
    const allowedUserIds = new Set([userId, ...watchedUserIds]);
    const next: Record<string, UserPresence> = {};
    Object.entries(presenceMap).forEach(([id, presence]) => {
      if (allowedUserIds.has(id)) {
        next[id] = presence;
      }
    });
    return next;
  }, [presenceMap, userId, watchedUserIds]);

  const setPresenceForUser = useCallback(
    (targetUserId: string, presence: UserPresence | null) => {
      setPresenceMap((prev) => {
        if (!presence) {
          if (!(targetUserId in prev)) return prev;
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        }

        const existing = prev[targetUserId];
        if (
          existing &&
          existing.status === presence.status &&
          existing.last_seen === presence.last_seen &&
          existing.username === presence.username
        ) {
          return prev;
        }

        return {
          ...prev,
          [targetUserId]: presence,
        };
      });
    },
    []
  );

  /** Update our status in our presence channel */
  const trackStatus = useCallback(
    (status: PresenceStatus) => {
      setMyStatus(status);
      myStatusRef.current = status;
      ownChannelRef.current?.track({
        user_id: userId,
        username,
        status,
        chat_with: chatWith ?? "",
        last_seen: new Date().toISOString(),
      });
    },
    [chatWith, userId, username]
  );

  /** Reset the idle timer — only relevant when in a chat */
  const resetIdleTimer = useCallback(() => {
    if (!isInChat) return;

    if (myStatusRef.current === "idle") {
      trackStatus("active");
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      trackStatus("idle");
    }, IDLE_TIMEOUT_MS);
  }, [isInChat, trackStatus]);

  useEffect(() => {
    if (!userId) return;

    const channels: RealtimeChannel[] = [];

    // Own presence channel.
    const ownChannel = supabase.channel(`presence:user:${userId}`, {
      config: { presence: { key: userId } },
    });
    ownChannelRef.current = ownChannel;
    channels.push(ownChannel);

    ownChannel
      .on("presence", { event: "sync" }, () => {
        const latest = getLatestPresence(ownChannel.presenceState<UserPresence>());
        setPresenceForUser(userId, latest);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ownChannel.track({
            user_id: userId,
            username,
            status: initialStatus,
            chat_with: chatWith ?? "",
            last_seen: new Date().toISOString(),
          });
        }
      });

    // Subscribe only to users we care about.
    watchedUserIds.forEach((watchedUserId) => {
      const watchedChannel = supabase.channel(`presence:user:${watchedUserId}`, {
        config: { presence: { key: watchedUserId } },
      });
      channels.push(watchedChannel);

      watchedChannel
        .on("presence", { event: "sync" }, () => {
          const latest = getLatestPresence(
            watchedChannel.presenceState<UserPresence>()
          );
          setPresenceForUser(watchedUserId, latest);
        })
        .subscribe();
    });

    // Only set up idle detection when user is in a chat
    if (isInChat) {
      const activityEvents = [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll",
      ];
      activityEvents.forEach((event) => {
        window.addEventListener(event, resetIdleTimer, { passive: true });
      });

      idleTimerRef.current = setTimeout(() => {
        trackStatus("idle");
      }, IDLE_TIMEOUT_MS);

      return () => {
        activityEvents.forEach((event) => {
          window.removeEventListener(event, resetIdleTimer);
        });

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        channels.forEach((channel) => channel.unsubscribe());
        ownChannelRef.current = null;
      };
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      channels.forEach((channel) => channel.unsubscribe());
      ownChannelRef.current = null;
    };
  }, [
    chatWith,
    initialStatus,
    isInChat,
    resetIdleTimer,
    setPresenceForUser,
    supabase,
    trackStatus,
    userId,
    username,
    watchedUserIds,
  ]);

  return { presenceMap: filteredPresenceMap, myStatus };
}
