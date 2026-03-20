"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { decryptMessage, encryptMessage } from "@/lib/crypto/e2ee";
import type { ChatMessage, EncryptedChatMessage } from "@/lib/types";

function isEncryptedChatMessage(value: unknown): value is EncryptedChatMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<EncryptedChatMessage>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sender_id === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.iv === "string" &&
    candidate.algorithm === "AES-GCM" &&
    candidate.version === 1
  );
}

/**
 * Custom hook to manage encrypted chat messages in localStorage.
 *
 * - Generates a deterministic storage key from two user IDs (sorted alphabetically)
 *   so both sides of the conversation share the same key.
 * - Stores encrypted payloads at rest.
 * - Decrypts payloads into UI messages when a conversation key is available.
 *
 * @param userId1 - Current user's ID
 * @param userId2 - Peer user's ID
 * @param conversationKey - Derived E2EE key for this conversation
 */
export function useLocalChat(
  userId1: string,
  userId2: string,
  conversationKey: CryptoKey | null
) {
  // Sort IDs to create a consistent key regardless of who initiates
  const storageKey = `chat_${[userId1, userId2].sort().join("_")}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const encryptedRef = useRef<EncryptedChatMessage[]>([]);

  const persistEncryptedMessages = useCallback(
    (next: EncryptedChatMessage[]) => {
      encryptedRef.current = next;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        console.warn("Encrypted local chat storage is full, using in-memory state.");
      }
    },
    [storageKey]
  );

  // Load and decrypt messages from localStorage when storage key or key changes
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      try {
        const stored = localStorage.getItem(storageKey);
        const parsed = stored ? (JSON.parse(stored) as unknown) : [];
        const encryptedMessages = Array.isArray(parsed)
          ? parsed.filter(isEncryptedChatMessage)
          : [];

        if (stored && Array.isArray(parsed) && parsed.length !== encryptedMessages.length) {
          localStorage.setItem(storageKey, JSON.stringify(encryptedMessages));
        }

        encryptedRef.current = encryptedMessages;

        if (!conversationKey) {
          if (isMounted) setMessages([]);
          return;
        }

        const decryptedMessages = await Promise.all(
          encryptedMessages.map(async (message) => {
            try {
              return await decryptMessage(message, conversationKey);
            } catch {
              return null;
            }
          })
        );

        if (isMounted) {
          setMessages(
            decryptedMessages.filter(
              (message): message is ChatMessage => message !== null
            )
          );
        }
      } catch {
        localStorage.removeItem(storageKey);
        encryptedRef.current = [];
        if (isMounted) setMessages([]);
      }
    };

    void loadMessages();
    return () => {
      isMounted = false;
    };
  }, [conversationKey, storageKey]);

  const mergeUnique = useCallback(
    <T extends { id: string }>(list: T[], item: T): T[] => {
      if (list.some((entry) => entry.id === item.id)) return list;
      return [...list, item];
    },
    []
  );

  /** Encrypt and append an outgoing message */
  const addOutgoingMessage = useCallback(
    async (message: ChatMessage): Promise<EncryptedChatMessage | null> => {
      if (!conversationKey) return null;

      const encryptedMessage = await encryptMessage(message, conversationKey);
      const nextEncrypted = mergeUnique(encryptedRef.current, encryptedMessage);
      persistEncryptedMessages(nextEncrypted);
      setMessages((prev) => mergeUnique(prev, message));
      return encryptedMessage;
    },
    [conversationKey, mergeUnique, persistEncryptedMessages]
  );

  /** Persist and decrypt an incoming encrypted message */
  const addIncomingEncryptedMessage = useCallback(
    async (encryptedMessage: EncryptedChatMessage): Promise<void> => {
      const nextEncrypted = mergeUnique(encryptedRef.current, encryptedMessage);
      if (nextEncrypted === encryptedRef.current) return;

      persistEncryptedMessages(nextEncrypted);
      if (!conversationKey) return;

      try {
        const decrypted = await decryptMessage(encryptedMessage, conversationKey);
        setMessages((prev) => mergeUnique(prev, decrypted));
      } catch {
        console.warn("Failed to decrypt incoming message.");
      }
    },
    [conversationKey, mergeUnique, persistEncryptedMessages]
  );

  /** Clear chat history for this conversation */
  const clearMessages = useCallback(() => {
    encryptedRef.current = [];
    setMessages([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { messages, addOutgoingMessage, addIncomingEncryptedMessage, clearMessages };
}
