import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore, get, set } from "idb-keyval";
import {
  clearChatIndexedDbData,
  readRoomMessages,
  writeRoomMessages,
} from "./indexedDbStorage";

const store = createStore("cqgram-chat-db", "cqgram-chat-kv");
const roomKey = "chat_messages:room-1";
const message = {
  id: "message-1",
  text: "private message text",
  senderId: "user-1",
  timestamp: "2026-11-05T00:00:00.000Z",
  status: "sent" as const,
};

describe("encrypted IndexedDB chat history", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {});
    await clearChatIndexedDbData();
  });

  it("stores ciphertext and returns the original messages", async () => {
    await writeRoomMessages("room-1", [message]);

    const stored = await get<unknown>(roomKey, store);
    expect(JSON.stringify(stored)).not.toContain(message.text);
    expect(stored).toMatchObject({ version: 1 });
    await expect(readRoomMessages("room-1")).resolves.toEqual([message]);
  });

  it("migrates legacy plaintext arrays when a room is opened", async () => {
    await set(roomKey, [message], store);

    await expect(readRoomMessages("room-1")).resolves.toEqual([message]);
    const migrated = await get<unknown>(roomKey, store);
    expect(migrated).toMatchObject({ version: 1 });
    expect(JSON.stringify(migrated)).not.toContain(message.text);
  });

  it("returns no messages when ciphertext authentication fails", async () => {
    await writeRoomMessages("room-1", [message]);
    const stored = (await get<{ version: number; iv: string; ciphertext: string }>(
      roomKey,
      store
    ))!;
    await set(roomKey, { ...stored, ciphertext: "AAAA" }, store);

    await expect(readRoomMessages("room-1")).resolves.toEqual([]);
  });
});
