import type { ChatMessage, EncryptedChatMessage } from "@/lib/types";
import { createStore, get, set } from "idb-keyval";

const IDENTITY_KEY_PREFIX = "cqgram:e2ee:identity";
const PEER_KEY_PREFIX = "cqgram:e2ee:peer-key";

type StoredIdentity = {
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
};

type LegacyStoredIdentity = {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
};

const identityKeyStore = createStore("cqgram-e2ee-db", "cqgram-e2ee-kv");

function getIdentityRecordKey(userId: string): string {
  return getIdentityStorageKey(userId);
}

function isStoredIdentity(value: unknown): value is StoredIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredIdentity>;
  const privateKey = candidate.privateKey;
  return Boolean(
    privateKey &&
      typeof privateKey === "object" &&
      "algorithm" in privateKey &&
      "extractable" in privateKey &&
      privateKey.extractable === false &&
      candidate.publicKeyJwk &&
      typeof candidate.publicKeyJwk === "object"
  );
}

function getIdentityStorageKey(userId: string): string {
  return `${IDENTITY_KEY_PREFIX}:${userId}`;
}

function getPeerStorageKey(userId: string, peerId: string): string {
  return `${PEER_KEY_PREFIX}:${userId}:${peerId}`;
}

function ensureBrowserStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("Secure storage is only available in the browser.");
  }
  return window.localStorage;
}

function ensureWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  return globalThis.crypto;
}

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

async function generateIdentityKeyPair(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}> {
  const webCrypto = ensureWebCrypto();
  const keyPair = (await webCrypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  )) as CryptoKeyPair;

  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    webCrypto.subtle.exportKey("jwk", keyPair.publicKey),
    webCrypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);

  return { publicKeyJwk, privateKeyJwk };
}

async function importPrivateIdentityKey(privateKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const webCrypto = ensureWebCrypto();
  return webCrypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveKey"]
  );
}

export async function importPeerPublicKey(publicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const webCrypto = ensureWebCrypto();
  return webCrypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

export async function getOrCreateIdentityKeyPair(userId: string): Promise<{
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}> {
  const storage = ensureBrowserStorage();
  const storageKey = getIdentityStorageKey(userId);
  const recordKey = getIdentityRecordKey(userId);
  const stored = await get<unknown>(recordKey, identityKeyStore);

  if (stored !== undefined) {
    if (!isStoredIdentity(stored)) {
      throw new Error("Stored E2EE identity key is invalid.");
    }
    return {
      privateKey: stored.privateKey,
      publicKeyJwk: stored.publicKeyJwk,
    };
  }

  // Migrate existing extractable JWKs once. Remove the plaintext copy only
  // after IndexedDB confirms that the non-extractable CryptoKey was stored.
  const legacy = storage.getItem(storageKey);
  if (legacy) {
    const parsed = JSON.parse(legacy) as LegacyStoredIdentity;
    if (!parsed.privateKeyJwk || !parsed.publicKeyJwk) {
      throw new Error("Legacy E2EE identity key is invalid.");
    }
    const privateKey = await importPrivateIdentityKey(parsed.privateKeyJwk);
    const migrated: StoredIdentity = {
      privateKey,
      publicKeyJwk: parsed.publicKeyJwk,
    };
    await set(recordKey, migrated, identityKeyStore);
    storage.removeItem(storageKey);
    return { privateKey, publicKeyJwk: parsed.publicKeyJwk };
  }

  const generated = await generateIdentityKeyPair();
  const privateKey = await importPrivateIdentityKey(generated.privateKeyJwk);
  const identity: StoredIdentity = {
    privateKey,
    publicKeyJwk: generated.publicKeyJwk,
  };
  await set(recordKey, identity, identityKeyStore);

  return {
    privateKey,
    publicKeyJwk: generated.publicKeyJwk,
  };
}

export function cachePeerPublicKeyJwk(
  currentUserId: string,
  peerUserId: string,
  publicKeyJwk: JsonWebKey
): void {
  const storage = ensureBrowserStorage();
  storage.setItem(
    getPeerStorageKey(currentUserId, peerUserId),
    JSON.stringify(publicKeyJwk)
  );
}

export function getCachedPeerPublicKeyJwk(
  currentUserId: string,
  peerUserId: string
): JsonWebKey | null {
  const storage = ensureBrowserStorage();
  const stored = storage.getItem(getPeerStorageKey(currentUserId, peerUserId));
  if (!stored) return null;

  try {
    return JSON.parse(stored) as JsonWebKey;
  } catch {
    storage.removeItem(getPeerStorageKey(currentUserId, peerUserId));
    return null;
  }
}

export async function deriveConversationKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  const webCrypto = ensureWebCrypto();
  return webCrypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  message: ChatMessage,
  conversationKey: CryptoKey
): Promise<EncryptedChatMessage> {
  const webCrypto = ensureWebCrypto();
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message.content);

  const encryptedBuffer = await webCrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    conversationKey,
    encoded
  );

  return {
    id: message.id,
    sender_id: message.sender_id,
    timestamp: message.timestamp,
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    algorithm: "AES-GCM",
    version: 1,
  };
}

export async function decryptMessage(
  encryptedMessage: EncryptedChatMessage,
  conversationKey: CryptoKey
): Promise<ChatMessage> {
  const webCrypto = ensureWebCrypto();
  const decoder = new TextDecoder();
  const iv = new Uint8Array(
    normalizeToArrayBuffer(base64ToBytes(encryptedMessage.iv))
  );
  const ciphertext = normalizeToArrayBuffer(
    base64ToBytes(encryptedMessage.ciphertext)
  );

  const decryptedBuffer = await webCrypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    conversationKey,
    ciphertext
  );

  return {
    id: encryptedMessage.id,
    sender_id: encryptedMessage.sender_id,
    timestamp: encryptedMessage.timestamp,
    content: decoder.decode(decryptedBuffer),
  };
}
