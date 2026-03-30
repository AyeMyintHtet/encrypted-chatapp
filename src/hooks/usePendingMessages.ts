"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAndClearPendingMessages } from "@/lib/supabase/messages";
import { useGlobalLoading } from "@/context/GlobalLoadingContext";
import { useChatStore } from "@/store/useChatStore";
import {
  deriveConversationKey,
  getCachedPeerPublicKeyJwk,
  getOrCreateIdentityKeyPair,
  importPeerPublicKey,
} from "@/lib/crypto/e2ee";
import { decryptMessage } from "@/lib/crypto/e2ee";
import type { PendingMessage } from "@/lib/types";
import type { Message } from "@/store/types";

/**
 * Hook that fetches pending (offline) messages from Supabase on page load,
 * decrypts them locally using the cached E2EE keys, and merges them into
 * the appropriate IndexedDB chat rooms.
 *
 * Shows the GlobalLoader while processing.
 *
 * Should be mounted once per authenticated page (e.g., dashboard, chat).
 * Runs only once per mount — subsequent navigations re-trigger via React unmount/remount.
 *
 * @param currentUserId - The authenticated user's UUID (empty string = skip)
 */
export function usePendingMessages(currentUserId: string) {
  const supabase = useMemo(() => createClient(), []);
  const { setIsLoading } = useGlobalLoading();
  const hasHydrated = useChatStore((state) => state.hasHydrated);
  const upsertRoomMessage = useChatStore((state) => state.upsertRoomMessage);

  // Prevent double-execution in React StrictMode
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!currentUserId || !hasHydrated || hasRunRef.current) return;
    hasRunRef.current = true;

    const processPendingMessages = async () => {
      setIsLoading(true);

      try {
        const pending = await fetchAndClearPendingMessages(supabase, currentUserId);
        if (pending.length === 0) return;

        // Group messages by room so we derive each conversation key only once
        const byRoom = new Map<string, PendingMessage[]>();
        for (const msg of pending) {
          const existing = byRoom.get(msg.room_id) ?? [];
          existing.push(msg);
          byRoom.set(msg.room_id, existing);
        }

        // Get our identity key once for all rooms
        const identity = await getOrCreateIdentityKeyPair(currentUserId);

        for (const [roomId, messages] of byRoom) {
          // Extract the peer's user ID from the first message in this room
          const peerId = messages[0].sender_id;

          // Look up cached peer public key
          const peerJwk = getCachedPeerPublicKeyJwk(currentUserId, peerId);
          if (!peerJwk) {
            // Can't decrypt without the peer's public key — skip this room.
            // Messages will be lost, but this is an edge case (first-ever chat
            // where keys haven't been exchanged yet via broadcast).
            console.warn(
              `[pending] No cached peer key for ${peerId}, skipping ${messages.length} message(s)`
            );
            continue;
          }

          try {
            const peerPublicKey = await importPeerPublicKey(peerJwk);
            const conversationKey = await deriveConversationKey(
              identity.privateKey,
              peerPublicKey
            );

            // Decrypt and merge each message into the local store
            for (const pending of messages) {
              try {
                const decrypted = await decryptMessage(
                  pending.encrypted_payload,
                  conversationKey
                );

                const storeMessage: Message = {
                  id: decrypted.id,
                  text: decrypted.content,
                  senderId: decrypted.sender_id,
                  timestamp: decrypted.timestamp,
                  status: "sent",
                };

                upsertRoomMessage(roomId, storeMessage);
              } catch {
                // Individual message decryption failure — skip it
                console.warn(`[pending] Failed to decrypt message ${pending.id}`);
              }
            }
          } catch {
            // Key derivation failure for this room — skip
            console.warn(`[pending] Key derivation failed for room ${roomId}`);
          }
        }
      } catch (error) {
        console.warn("[pending] Error processing pending messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void processPendingMessages();
  }, [currentUserId, hasHydrated, setIsLoading, supabase, upsertRoomMessage]);
}
