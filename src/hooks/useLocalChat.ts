"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
} from "react";
import { decryptMessage, encryptMessage } from "@/lib/crypto/e2ee";
import type { ChatMessage, EncryptedChatMessage } from "@/lib/types";
import { useChatStore } from "@/store/useChatStore";
import type { Message } from "@/store/types";

const EMPTY_MESSAGES: Message[] = [];

function asStoreMessage(
  message: ChatMessage,
  status: Message["status"] = "sent"
): Message {
  return {
    id: message.id,
    text: message.content,
    senderId: message.sender_id,
    timestamp: message.timestamp,
    status,
  };
}

function asChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    content: message.text,
    sender_id: message.senderId,
    timestamp: message.timestamp,
  };
}

function mergeMessageById(messages: Message[], incoming: Message): Message[] {
  const targetIndex = messages.findIndex((message) => message.id === incoming.id);
  if (targetIndex < 0) {
    return [...messages, incoming];
  }

  const next = [...messages];
  next[targetIndex] = incoming;
  return next;
}

/**
 * Custom hook to manage encrypted chat messages with IndexedDB persistence.
 *
 * - Generates a deterministic room key from two user IDs (sorted alphabetically).
 * - Persists room history through `useChatStore` + IndexedDB.
 * - Uses React 19 optimistic state to render outgoing messages immediately.
 * - Decrypts incoming encrypted payloads into UI messages.
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
  const roomId = useMemo(() => {
    if (!userId1 || !userId2) return "";
    return `chat_${[userId1, userId2].sort().join("_")}`;
  }, [userId1, userId2]);

  const hasHydrated = useChatStore((state) => state.hasHydrated);
  const persistedMessages = useChatStore(
    (state) => state.chat_messages[roomId] ?? EMPTY_MESSAGES
  );
  const loadRoomMessages = useChatStore((state) => state.loadRoomMessages);
  const upsertRoomMessage = useChatStore((state) => state.upsertRoomMessage);
  const updateMessageStatus = useChatStore((state) => state.updateMessageStatus);
  const clearRoomMessages = useChatStore((state) => state.clearRoomMessages);
  const setRoomMessages = useChatStore((state) => state.setRoomMessages);
  const getRoomMessages = useChatStore((state) => state.getRoomMessages);

  useEffect(() => {
    if (!hasHydrated || !roomId) return;
    void loadRoomMessages(roomId);
  }, [hasHydrated, roomId, loadRoomMessages]);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    persistedMessages,
    (currentState, optimisticMessage: Message) =>
      mergeMessageById(currentState, optimisticMessage)
  );

  const messages = useMemo(
    () => optimisticMessages.map(asChatMessage),
    [optimisticMessages]
  );

  /** Encrypt and append an outgoing message */
  const addOutgoingMessage = useCallback(
    async (message: ChatMessage): Promise<EncryptedChatMessage | null> => {
      if (!roomId) return null;
      const optimisticMessage = asStoreMessage(message, "sending");
      startTransition(() => {
        addOptimisticMessage(optimisticMessage);
      });
      upsertRoomMessage(roomId, optimisticMessage);

      if (!conversationKey) {
        updateMessageStatus(roomId, message.id, "error");
        return null;
      }

      try {
        return await encryptMessage(message, conversationKey);
      } catch {
        updateMessageStatus(roomId, message.id, "error");
        throw new Error("Failed to encrypt outgoing message");
      }
    },
    [
      addOptimisticMessage,
      conversationKey,
      roomId,
      updateMessageStatus,
      upsertRoomMessage,
    ]
  );

  /** Persist and decrypt an incoming encrypted message */
  const addIncomingEncryptedMessage = useCallback(
    async (encryptedMessage: EncryptedChatMessage): Promise<void> => {
      if (!conversationKey || !roomId) return;

      try {
        const decrypted = await decryptMessage(encryptedMessage, conversationKey);
        upsertRoomMessage(roomId, asStoreMessage(decrypted, "sent"));
      } catch {
        console.warn("Failed to decrypt incoming message.");
      }
    },
    [conversationKey, roomId, upsertRoomMessage]
  );

  /** Mark optimistic message as delivered */
  const markOutgoingMessageSent = useCallback(
    (messageId: string) => {
      if (!roomId) return;
      updateMessageStatus(roomId, messageId, "sent");
    },
    [roomId, updateMessageStatus]
  );

  /** Mark optimistic message as failed */
  const markOutgoingMessageError = useCallback(
    (messageId: string) => {
      if (!roomId) return;
      updateMessageStatus(roomId, messageId, "error");
    },
    [roomId, updateMessageStatus]
  );

  /** Clear chat history for this conversation */
  const clearMessages = useCallback(() => {
    if (!roomId) return;
    clearRoomMessages(roomId);
  }, [clearRoomMessages, roomId]);

  /** Redact messages sent by a specific user instead of fully removing them */
  const deleteMessagesFromUser = useCallback(
    async (userId: string, username: string) => {
      if (!roomId) return;
      const redactedText = `${username} was deleted his/her message`;
      const nextMessages = getRoomMessages(roomId).map((message) =>
        message.senderId === userId
          ? { ...message, text: redactedText, status: "sent" as const }
          : message
      );
      setRoomMessages(roomId, nextMessages);
    },
    [getRoomMessages, roomId, setRoomMessages]
  );

  return {
    hasHydrated,
    messages,
    addOutgoingMessage,
    addIncomingEncryptedMessage,
    markOutgoingMessageSent,
    markOutgoingMessageError,
    clearMessages,
    deleteMessagesFromUser,
  };
}
