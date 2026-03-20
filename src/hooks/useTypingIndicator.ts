"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

// How long after the last keystroke before we consider the user stopped typing
const TYPING_DEBOUNCE_MS = 2000;
// Safety fallback on receiver side in case "typing_stop" is never received
// (e.g. peer closes tab). Must be longer than TYPING_DEBOUNCE_MS.
const PEER_SAFETY_TIMEOUT_MS = 4000;

/**
 * Hook to broadcast and receive real-time typing indicators
 * over an existing Supabase Broadcast channel.
 *
 * Flow:
 *  1. First keystroke  → broadcast "typing_start" once
 *  2. Each keystroke   → reset the 2s debounce timer (no extra broadcasts)
 *  3. 2s of inactivity → broadcast "typing_stop", ready for next burst
 *
 * @param channel        - The active Supabase RealtimeChannel (shared with chat)
 * @param currentUserId  - Current user's ID (filters out own echoes)
 */
export function useTypingIndicator(
  channel: RealtimeChannel | null,
  currentUserId: string
) {
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  // Whether we've already sent "typing_start" for this burst
  const isBroadcastingRef = useRef(false);
  // Debounce timer — fires "typing_stop" after inactivity
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Safety timer on receiver side — auto-hides indicator if "typing_stop" is lost
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Call on every keystroke in the input field.
   * Sends "typing_start" once per burst, then debounces "typing_stop".
   */
  const notifyTyping = useCallback(() => {
    if (!channel) return;

    // Send "typing_start" only on the first keystroke of a new burst
    if (!isBroadcastingRef.current) {
      isBroadcastingRef.current = true;
      channel.send({
        type: "broadcast",
        event: "typing_start",
        payload: { sender_id: currentUserId },
      });
    }

    // Reset the debounce — if user stays idle for 2s, fire "typing_stop"
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isBroadcastingRef.current = false;
      channel.send({
        type: "broadcast",
        event: "typing_stop",
        payload: { sender_id: currentUserId },
      });
    }, TYPING_DEBOUNCE_MS);
  }, [channel, currentUserId]);

  // Listen for peer's typing events on the shared channel
  useEffect(() => {
    if (!channel) return;

    const handleTypingStart = (msg: { payload: { sender_id: string } }) => {
      if (msg.payload.sender_id === currentUserId) return;
      setIsPeerTyping(true);

      // Reset safety timeout every time (covers edge cases like tab close)
      if (safetyRef.current) clearTimeout(safetyRef.current);
      safetyRef.current = setTimeout(() => setIsPeerTyping(false), PEER_SAFETY_TIMEOUT_MS);
    };

    const handleTypingStop = (msg: { payload: { sender_id: string } }) => {
      if (msg.payload.sender_id === currentUserId) return;
      setIsPeerTyping(false);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };

    channel.on("broadcast", { event: "typing_start" }, handleTypingStart);
    channel.on("broadcast", { event: "typing_stop" }, handleTypingStop);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
      isBroadcastingRef.current = false;
      setIsPeerTyping(false);
    };
  }, [channel, currentUserId]);

  return { isPeerTyping, notifyTyping };
}
