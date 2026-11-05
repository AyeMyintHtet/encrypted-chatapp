import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, get, set } from "idb-keyval";
import { getOrCreateIdentityKeyPair } from "./e2ee";

const identityStore = createStore("cqgram-e2ee-db", "cqgram-e2ee-kv");
const identityStorageKey = "cqgram:e2ee:identity:user-1";
const records = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => records.get(key) ?? null,
  setItem: (key: string, value: string) => void records.set(key, value),
  removeItem: (key: string) => void records.delete(key),
};

describe("E2EE identity key storage", () => {
  beforeEach(async () => {
    await set(identityStorageKey, undefined, identityStore);
    records.clear();
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  it("migrates a legacy JWK and removes it after storing a non-extractable key", async () => {
    const pair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    )) as CryptoKeyPair;
    const legacy = {
      privateKeyJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    };
    records.set(identityStorageKey, JSON.stringify(legacy));

    const identity = await getOrCreateIdentityKeyPair("user-1");

    expect(identity.privateKey.extractable).toBe(false);
    expect(records.has(identityStorageKey)).toBe(false);
    const stored = await get<{ privateKey: CryptoKey; publicKeyJwk: JsonWebKey }>(
      identityStorageKey,
      identityStore
    );
    if (!stored) throw new Error("Migrated identity was not persisted.");
    expect(stored.privateKey.extractable).toBe(false);
    expect(stored.publicKeyJwk).toEqual(legacy.publicKeyJwk);
    await expect(getOrCreateIdentityKeyPair("user-1")).resolves.toMatchObject({
      publicKeyJwk: legacy.publicKeyJwk,
    });
  });

  it("creates non-extractable identity keys without writing private JWKs to localStorage", async () => {
    const identity = await getOrCreateIdentityKeyPair("user-1");

    expect(identity.privateKey.extractable).toBe(false);
    expect(records.size).toBe(0);
    const stored = await get(identityStorageKey, identityStore);
    expect(stored).toBeDefined();
  });
});
