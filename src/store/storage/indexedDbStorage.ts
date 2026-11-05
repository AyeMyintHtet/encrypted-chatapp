import type { StateStorage } from "zustand/middleware";
import { clear, createStore, del, get, set } from "idb-keyval";
import type { Message } from "@/store/types";

const CHAT_DB_NAME = "cqgram-chat-db";
const CHAT_STORE_NAME = "cqgram-chat-kv";
const ROOM_MESSAGES_PREFIX = "chat_messages:";
const MESSAGE_KEY_NAME = "chat_messages_encryption_key";
const ENCRYPTED_MESSAGES_VERSION = 1 as const;

type EncryptedMessages = {
  version: typeof ENCRYPTED_MESSAGES_VERSION;
  iv: string;
  ciphertext: string;
};

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64Value: string): Uint8Array {
  const binary = atob(base64Value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function getOrCreateMessageEncryptionKey(): Promise<CryptoKey> {
  const storedKey = await get<unknown>(MESSAGE_KEY_NAME, chatKeyValueStore);
  if (storedKey !== undefined) {
    if (
      storedKey &&
      typeof storedKey === "object" &&
      "algorithm" in storedKey &&
      "extractable" in storedKey &&
      storedKey.extractable === false
    ) {
      return storedKey as CryptoKey;
    }
    throw new Error("Stored local message encryption key is invalid.");
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await set(MESSAGE_KEY_NAME, key, chatKeyValueStore);
  return key;
}

async function encryptMessages(messages: Message[]): Promise<EncryptedMessages> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(messages));
  const key = await getOrCreateMessageEncryptionKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return {
    version: ENCRYPTED_MESSAGES_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptMessages(value: EncryptedMessages): Promise<Message[]> {
  const key = await getOrCreateMessageEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: normalizeToArrayBuffer(base64ToBytes(value.iv)) },
    key,
    normalizeToArrayBuffer(base64ToBytes(value.ciphertext))
  );
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  return Array.isArray(parsed) ? parsed.filter(isMessage) : [];
}

function isEncryptedMessages(value: unknown): value is EncryptedMessages {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedMessages>;
  return (
    candidate.version === ENCRYPTED_MESSAGES_VERSION &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

export async function readRoomMessages(roomId: string): Promise<Message[]> {
  if (!isBrowser()) return [];
  const key = getRoomMessagesKey(roomId);
  const value = await get<unknown>(key, chatKeyValueStore);

  // Migrate legacy plaintext history the first time a room is opened.
  if (Array.isArray(value)) {
    const messages = value.filter(isMessage);
    await set(key, await encryptMessages(messages), chatKeyValueStore);
    return messages;
  }

  if (!isEncryptedMessages(value)) return [];
  try {
    return await decryptMessages(value);
  } catch {
    // Authentication failure or corrupt data must not be treated as plaintext.
    return [];
  }
}

export async function writeRoomMessages(
  roomId: string,
  messages: Message[]
): Promise<void> {
  if (!isBrowser()) return;
  await set(
    getRoomMessagesKey(roomId),
    await encryptMessages(messages),
    chatKeyValueStore
  );
}

export async function deleteRoomMessages(roomId: string): Promise<void> {
  if (!isBrowser()) return;
  await del(getRoomMessagesKey(roomId), chatKeyValueStore);
}

export async function clearChatIndexedDbData(): Promise<void> {
  if (!isBrowser()) return;
  await clear(chatKeyValueStore);
}

