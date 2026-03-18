import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "@/lib/types";

/**
 * Subscribes to real-time INSERT events on the `messages` table.
 *
 * Designed for high-frequency chat scenarios (Telegram-style):
 *  - Events are appended directly to the Zustand store for instant UI updates.
 *  - Duplicate detection prevents the same message from appearing twice
 *    (e.g. if the sender also receives their own broadcast).
 *
 * @param channelName - Unique channel identifier (e.g. `messages:room-abc`)
 * @param filterColumn - Column to filter on (e.g. `room_id`)
 * @param filterValue  - Value to match (e.g. the chat room ID)
 * @returns A cleanup function that removes the channel subscription.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToMessages(
 *     `messages:${roomId}`,
 *     "room_id",
 *     roomId
 *   );
 *   return unsubscribe;
 * }, [roomId]);
 * ```
 */
export function subscribeToMessages(
  channelName: string,
  filterColumn: string,
  filterValue: string
): () => void {
  const supabase = createClient();

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `${filterColumn}=eq.${filterValue}`,
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage;

        // Prevent duplicates — the sender might already have the message
        // from an optimistic update or from receiving their own broadcast.
        const existing = useAppStore.getState().messages;
        const isDuplicate = existing.some((m) => m.id === newMessage.id);

        if (!isDuplicate) {
          useAppStore.getState().addMessage(newMessage);
        }
      }
    )
    .subscribe((status, err) => {
      // Surface subscription lifecycle in the console for debugging
      if (status === "SUBSCRIBED") {
        console.info(`[subscribeToMessages] Listening on "${channelName}"`);
      } else if (status === "CHANNEL_ERROR") {
        console.warn(
          `[subscribeToMessages] Channel error on "${channelName}":`,
          err
        );
      } else if (status === "TIMED_OUT") {
        console.warn(
          `[subscribeToMessages] Subscription timed out for "${channelName}". ` +
            "The WebSocket connection may have failed — check your network tab."
        );
      }
    });

  // Return cleanup function for use in useEffect teardown
  return () => {
    supabase.removeChannel(channel);
  };
}
