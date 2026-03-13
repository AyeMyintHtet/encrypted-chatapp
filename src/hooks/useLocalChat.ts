"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

/**
 * Custom hook to manage chat messages in localStorage.
 *
 * - Generates a deterministic storage key from two user IDs (sorted alphabetically)
 *   so both sides of the conversation share the same key.
 * - Loads existing messages on mount.
 * - Provides `addMessage` to append a new message and persist it.
 *
 * @param userId1 - Current user's ID
 * @param userId2 - Peer user's ID
 */
export function useLocalChat(userId1: string, userId2: string) {
  // Sort IDs to create a consistent key regardless of who initiates
  const storageKey = `chat_${[userId1, userId2].sort().join("_")}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        setMessages(parsed);
      }
    } catch {
      // Corrupted data — reset
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  /** Append a new message and persist to localStorage */
  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => {
        // Deduplicate by message ID to prevent double-adds from broadcast echoes
        if (prev.some((m) => m.id === message.id)) return prev;

        const updated = [...prev, message];

        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // localStorage full — keep in-memory only
          console.warn("localStorage is full, messages are in-memory only");
        }

        return updated;
      });
    },
    [storageKey]
  );

  /** Clear chat history for this conversation */
  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { messages, addMessage, clearMessages };
}
