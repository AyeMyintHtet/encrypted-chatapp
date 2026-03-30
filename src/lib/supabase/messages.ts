/**
 * Supabase helpers for the `pending_messages` table.
 *
 * Pending messages store **already-encrypted** payloads (ciphertext + IV)
 * so the server never sees plaintext. They bridge the gap when the receiver
 * is offline — the sender INSERTs, and the receiver SELECTs + DELETEs
 * when they come back online.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EncryptedChatMessage, PendingMessage } from "@/lib/types";

/**
 * Insert an encrypted message for offline delivery.
 *
 * @param supabase  - Authenticated Supabase client
 * @param roomId    - Deterministic room key (`chat_{sorted_ids}`)
 * @param senderId  - Current user's UUID
 * @param receiverId - Peer's UUID
 * @param payload   - The already-encrypted message (ciphertext, iv, etc.)
 */
export async function insertPendingMessage(
  supabase: SupabaseClient,
  roomId: string,
  senderId: string,
  receiverId: string,
  payload: EncryptedChatMessage
): Promise<void> {
  const { error } = await supabase.from("pending_messages").insert({
    room_id: roomId,
    sender_id: senderId,
    receiver_id: receiverId,
    encrypted_payload: payload,
  });

  if (error) {
    // Non-critical path — log but don't break chat flow
    console.warn("[pending_messages] INSERT failed:", error.message);
  }
}

/**
 * Fetch all pending messages addressed to the current user, then delete them.
 * Uses a single SELECT followed by a bulk DELETE to keep the round-trips minimal.
 *
 * @param supabase    - Authenticated Supabase client
 * @param receiverId  - Current user's UUID
 * @returns Array of pending messages (empty if none)
 */
export async function fetchAndClearPendingMessages(
  supabase: SupabaseClient,
  receiverId: string
): Promise<PendingMessage[]> {
  // Step 1: Fetch all pending messages for this receiver, oldest first
  const { data, error: selectError } = await supabase
    .from("pending_messages")
    .select("*")
    .eq("receiver_id", receiverId)
    .order("created_at", { ascending: true });

  if (selectError) {
    console.warn("[pending_messages] SELECT failed:", selectError.message);
    return [];
  }

  const messages = (data ?? []) as PendingMessage[];
  if (messages.length === 0) return [];

  // Step 2: Delete the fetched messages so they aren't re-delivered
  const messageIds = messages.map((m) => m.id);
  const { error: deleteError } = await supabase
    .from("pending_messages")
    .delete()
    .in("id", messageIds);

  if (deleteError) {
    console.warn("[pending_messages] DELETE failed:", deleteError.message);
    // Still return messages — idempotent dedup happens client-side
  }

  return messages;
}
