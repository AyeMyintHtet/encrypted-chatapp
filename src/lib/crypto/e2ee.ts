import type { ChatMessage, EncryptedChatMessage } from "@/lib/types";

const IDENTITY_KEY_PREFIX = "cqgram:e2ee:identity";
const PEER_KEY_PREFIX = "cqgram:e2ee:peer-key";

type StoredIdentity = {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
};

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
  privateKey: CryptoKey;
  publicKey: CryptoKey;
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

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyJwk,
    privateKeyJwk,
  };
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
    true,
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
  const stored = storage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredIdentity;
      const privateKey = await importPrivateIdentityKey(parsed.privateKeyJwk);
      return { privateKey, publicKeyJwk: parsed.publicKeyJwk };
    } catch {
      storage.removeItem(storageKey);
    }
  }

  const generated = await generateIdentityKeyPair();
  const payload: StoredIdentity = {
    privateKeyJwk: generated.privateKeyJwk,
    publicKeyJwk: generated.publicKeyJwk,
  };
  storage.setItem(storageKey, JSON.stringify(payload));

  return {
    privateKey: generated.privateKey,
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
