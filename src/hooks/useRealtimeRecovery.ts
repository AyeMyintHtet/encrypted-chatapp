"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recovers Supabase Realtime connections after the browser tab wakes up.
 *
 * **Why this is needed:**
 *   Even with `worker: true`, deep OS sleep or network changes can still
 *   disconnect the WebSocket. When the user returns to the tab we need to:
 *     1. Check if the underlying socket is still alive.
 *     2. Force a reconnect if it isn't.
 *
 * This hook listens for the `visibilitychange` event and, when the tab
 * becomes visible again, inspects `client.realtime` to decide whether
 * a reconnect is necessary.
 *
 * @param supabase  The singleton Supabase browser client
 * @param enabled   Pass `false` to disable (e.g. while profiles are loading)
 */
export function useRealtimeRecovery(
  supabase: SupabaseClient,
  enabled = true
): void {
  // Track connectivity so we only log/reconnect once per wake cycle
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rt = supabase.realtime as any;

      // `rt.conn` is the underlying WebSocket instance managed by RealtimeClient.
      // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
      const socket: WebSocket | null | undefined = rt.conn;
      const isAlive = socket?.readyState === WebSocket.OPEN;

      if (!isAlive) {
        // Prevent repeated reconnect attempts during a single wake cycle
        if (!wasDisconnectedRef.current) {
          wasDisconnectedRef.current = true;
          console.info(
            "[RealtimeRecovery] Tab resumed — WebSocket is dead, forcing reconnect."
          );
        }

        // `disconnect()` cleans up the old socket; `connect()` opens a fresh one.
        // All existing channel subscriptions are automatically re-joined by RealtimeClient.
        try {
          rt.disconnect();
        } catch {
          // Ignore — socket may already be gone
        }
        rt.connect();
      } else {
        // Socket survived sleep — nothing to do
        if (wasDisconnectedRef.current) {
          console.info(
            "[RealtimeRecovery] Tab resumed — WebSocket is still alive."
          );
        }
        wasDisconnectedRef.current = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [supabase, enabled]);
}
