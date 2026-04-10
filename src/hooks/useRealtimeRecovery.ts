"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

// A minimal typed interface for internal RealtimeClient properties.
// Avoids `any` while giving us access to the underlying socket logic.
interface RealtimeClientMinimal {
  conn?: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
}

const DEBUG = process.env.NODE_ENV !== "production";

/**
 * Recovers Supabase Realtime connections after the browser tab wakes up.
 *
 * Expected behavior:
 * - tab hidden → visible with open socket: verify socket state, do nothing if connected.
 * - visible with closed socket: forces a disconnect/reconnect cycle safely.
 * - repeated visibility events: throttled by a short cooldown to avoid connect bursts.
 * - offline/online transitions: checks navigator.onLine and defers reconnect if offline.
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
  const lastActiveRef = useRef<number>(0);

  useEffect(() => {
    // Defensive SSR check
    if (typeof document === "undefined" || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      // Throttle visible event handling to prevent rapid reconnect bursts
      const now = Date.now();
      if (now - lastActiveRef.current < 2000) return;
      lastActiveRef.current = now;

      // Defer reconnect if device is completely offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      const rt = supabase.realtime as unknown as RealtimeClientMinimal;
      const socket = rt.conn;

      const isAlive = socket?.readyState === WebSocket.OPEN;
      const isConnecting = socket?.readyState === WebSocket.CONNECTING;

      if (!isAlive && !isConnecting) {
        // Prevent repeated reconnect attempts during a single wake cycle
        if (!wasDisconnectedRef.current) {
          wasDisconnectedRef.current = true;
          if (DEBUG) {
            console.info(
              "[RealtimeRecovery] Tab resumed — WebSocket disconnected, forcing reconnect."
            );
          }
        }

        // `disconnect()` cleans up the old socket; `connect()` opens a fresh one.
        // All existing channel subscriptions are a utomatically re-joined by RealtimeClient.
        try {
          rt.disconnect();
        } catch {
          // Ignore — socket may already be gone
        }
        rt.connect();
      } else {
        // Socket survived sleep or is currently connecting
        if (wasDisconnectedRef.current) {
          if (DEBUG) {
            console.info(
              "[RealtimeRecovery] Tab resumed — WebSocket is still alive or connecting."
            );
          }
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
