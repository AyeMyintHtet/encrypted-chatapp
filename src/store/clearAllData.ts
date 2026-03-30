import { clearChatStoreData } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Clears all client-side persisted data for security-sensitive flows:
 * - localStorage/sessionStorage
 * - auth store (localStorage persistence)
 * - chat store + room messages (IndexedDB)
 */
export async function clearAllClientData(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }

  useAuthStore.getState().clearStore();
  useAuthStore.persist.clearStorage();
  await clearChatStoreData();
}
