import type { StateStorage } from "zustand/middleware";
import { clear, createStore, del, get, set } from "idb-keyval";
import type { Message } from "@/store/types";

const CHAT_DB_NAME = "cqgram-chat-db";
const CHAT_STORE_NAME = "cqgram-chat-kv";
const ROOM_MESSAGES_PREFIX = "chat_messages:";

const chatKeyValueStore = createStore(CHAT_DB_NAME, CHAT_STORE_NAME);

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function getRoomMessagesKey(roomId: string): string {
  return `${ROOM_MESSAGES_PREFIX}${roomId}`;
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Message>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.senderId === "string" &&
    typeof candidate.timestamp === "string" &&
    (candidate.status === "sending" ||
      candidate.status === "sent" ||
      candidate.status === "error")
  );
}

export const indexedDbStateStorage: StateStorage = {
  getItem: async (name) => {
    if (!isBrowser()) return null;
    const value = await get<unknown>(name, chatKeyValueStore);
    return typeof value === "string" ? value : null;
  },
  setItem: async (name, value) => {
    if (!isBrowser()) return;
    await set(name, value, chatKeyValueStore);
  },
  removeItem: async (name) => {
    if (!isBrowser()) return;
    await del(name, chatKeyValueStore);
  },
};

export async function readRoomMessages(roomId: string): Promise<Message[]> {
  if (!isBrowser()) return [];
  const value = await get<unknown>(getRoomMessagesKey(roomId), chatKeyValueStore);
  if (!Array.isArray(value)) return [];
  return value.filter(isMessage);
}

export async function writeRoomMessages(
  roomId: string,
  messages: Message[]
): Promise<void> {
  if (!isBrowser()) return;
  await set(getRoomMessagesKey(roomId), messages, chatKeyValueStore);
}

export async function deleteRoomMessages(roomId: string): Promise<void> {
  if (!isBrowser()) return;
  await del(getRoomMessagesKey(roomId), chatKeyValueStore);
}

export async function clearChatIndexedDbData(): Promise<void> {
  if (!isBrowser()) return;
  await clear(chatKeyValueStore);
}
