import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import type { PublicProfile } from "@/lib/types";
import type { ContactsByUser, Message, RoomHistory } from "@/store/types";
import {
  clearChatIndexedDbData,
  deleteRoomMessages,
  indexedDbStateStorage,
  readRoomMessages,
  writeRoomMessages,
} from "@/store/storage/indexedDbStorage";

interface PendingRequest {
  id: string;
  requester_id: string;
  profile: PublicProfile;
}

interface ChatStoreState {
  contacts: PublicProfile[];
  contact_list: ContactsByUser;
  activeContactsUserId: string | null;
  pendingRequests: PendingRequest[];
  searchResults: PublicProfile[];
  chat_messages: Record<string, Message[]>;
  room_history: RoomHistory;
  hasHydrated: boolean;

  isContactsLoading: boolean;
  isRequestsLoading: boolean;
  isSearching: boolean;

  setContacts: (currentUserId: string, contacts: PublicProfile[]) => void;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSearchResults: (results: PublicProfile[]) => void;
  setRoomMessages: (roomId: string, messages: Message[]) => void;
  loadRoomMessages: (roomId: string) => Promise<Message[]>;
  upsertRoomMessage: (roomId: string, message: Message) => void;
  updateMessageStatus: (
    roomId: string,
    messageId: string,
    status: Message["status"]
  ) => void;
  clearRoomMessages: (roomId: string) => void;
  getRoomMessages: (roomId: string) => Message[];

  optimisticClearContacts: () => void;
  optimisticRemoveContact: (contactId: string) => void;
  optimisticAcceptRequest: (connectionId: string) => void;
  optimisticDeclineRequest: (connectionId: string) => void;
  optimisticSendConnection: (receiverId: string) => void;

  fetchContacts: (currentUserId: string) => Promise<void>;
  fetchPendingRequests: (currentUserId: string) => Promise<void>;
  searchUsers: (currentUserId: string, query: string) => Promise<void>;

  clearStore: () => void;
  setHasHydrated: (value: boolean) => void;
}

const STORE_NAME = "cqgram-chat-store-v1";

const abortControllers: Record<string, AbortController> = {};

function upsertContactsCache(
  contactList: ContactsByUser,
  currentUserId: string,
  contacts: PublicProfile[]
): ContactsByUser {
  return {
    ...contactList,
    [currentUserId]: contacts,
  };
}

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function getNextMessages(messages: Message[], message: Message): Message[] {
  const targetIndex = messages.findIndex((entry) => entry.id === message.id);
  if (targetIndex < 0) {
    return sortMessages([...messages, message]);
  }
  const next = [...messages];
  next[targetIndex] = message;
  return next;
}

function getRoomHistoryEntry(messages: Message[]) {
  if (messages.length === 0) {
    return {
      lastMessageAt: null,
      messageCount: 0,
    };
  }

  const sorted = sortMessages(messages);
  return {
    lastMessageAt: sorted[sorted.length - 1]?.timestamp ?? null,
    messageCount: sorted.length,
  };
}

function upsertRoomHistory(
  roomHistory: RoomHistory,
  roomId: string,
  messages: Message[]
): RoomHistory {
  if (messages.length === 0) {
    const nextRoomHistory = { ...roomHistory };
    delete nextRoomHistory[roomId];
    return nextRoomHistory;
  }

  const nextEntry = getRoomHistoryEntry(messages);
  return {
    ...roomHistory,
    [roomId]: {
      roomId,
      ...nextEntry,
    },
  };
}

const initialState = {
  contacts: [] as PublicProfile[],
  contact_list: {} as ContactsByUser,
  activeContactsUserId: null as string | null,
  pendingRequests: [] as PendingRequest[],
  searchResults: [] as PublicProfile[],
  chat_messages: {} as Record<string, Message[]>,
  room_history: {} as RoomHistory,
  hasHydrated: false,
  isContactsLoading: true,
  isRequestsLoading: true,
  isSearching: false,
};

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setContacts: (currentUserId, contacts) =>
        set((state) => ({
          contacts,
          activeContactsUserId: currentUserId,
          contact_list: upsertContactsCache(state.contact_list, currentUserId, contacts),
          isContactsLoading: false,
        })),
      setPendingRequests: (requests) =>
        set({ pendingRequests: requests, isRequestsLoading: false }),
      setSearchResults: (results) =>
        set({ searchResults: results, isSearching: false }),
      setRoomMessages: (roomId, messages) => {
        const nextMessages = sortMessages(messages);
        set((state) => ({
          chat_messages: {
            ...state.chat_messages,
            [roomId]: nextMessages,
          },
          room_history: upsertRoomHistory(state.room_history, roomId, nextMessages),
        }));
        void writeRoomMessages(roomId, nextMessages);
      },
      loadRoomMessages: async (roomId) => {
        const cached = get().chat_messages[roomId];
        if (cached) return cached;

        const loaded = sortMessages(await readRoomMessages(roomId));
        set((state) => ({
          chat_messages: {
            ...state.chat_messages,
            [roomId]: loaded,
          },
          room_history: upsertRoomHistory(state.room_history, roomId, loaded),
        }));
        return loaded;
      },
      upsertRoomMessage: (roomId, message) => {
        let nextMessages: Message[] = [];
        set((state) => {
          const currentMessages = state.chat_messages[roomId] ?? [];
          nextMessages = getNextMessages(currentMessages, message);
          return {
            chat_messages: {
              ...state.chat_messages,
              [roomId]: nextMessages,
            },
            room_history: upsertRoomHistory(state.room_history, roomId, nextMessages),
          };
        });
        void writeRoomMessages(roomId, nextMessages);
      },
      updateMessageStatus: (roomId, messageId, status) => {
        let nextMessages: Message[] = [];
        set((state) => {
          const currentMessages = state.chat_messages[roomId] ?? [];
          if (currentMessages.length === 0) return state;

          nextMessages = currentMessages.map((message) =>
            message.id === messageId ? { ...message, status } : message
          );

          return {
            chat_messages: {
              ...state.chat_messages,
              [roomId]: nextMessages,
            },
            room_history: upsertRoomHistory(state.room_history, roomId, nextMessages),
          };
        });
        if (nextMessages.length > 0) {
          void writeRoomMessages(roomId, nextMessages);
        }
      },
      clearRoomMessages: (roomId) => {
        set((state) => {
          const nextMessages = { ...state.chat_messages };
          delete nextMessages[roomId];
          return {
            chat_messages: nextMessages,
            room_history: upsertRoomHistory(state.room_history, roomId, []),
          };
        });
        void deleteRoomMessages(roomId);
      },
      getRoomMessages: (roomId) => get().chat_messages[roomId] ?? [],
      clearStore: () =>
        set({
          ...initialState,
          hasHydrated: true,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),

      optimisticClearContacts: () =>
        set((state) => {
          const currentUserId = state.activeContactsUserId;
          if (!currentUserId) {
            return { contacts: [] };
          }

          return {
            contacts: [],
            contact_list: upsertContactsCache(state.contact_list, currentUserId, []),
          };
        }),

      optimisticRemoveContact: (contactId) =>
        set((state) => {
          const currentUserId = state.activeContactsUserId;
          if (!currentUserId) return state;

          const nextContacts = state.contacts.filter((contact) => contact.id !== contactId);
          return {
            contacts: nextContacts,
            contact_list: upsertContactsCache(
              state.contact_list,
              currentUserId,
              nextContacts
            ),
          };
        }),

      optimisticAcceptRequest: (connectionId) => {
        const { pendingRequests, contacts, activeContactsUserId, contact_list } = get();
        const request = pendingRequests.find((entry) => entry.id === connectionId);
        if (!request) return;

        const nextContacts = [...contacts, request.profile];
        set({
          pendingRequests: pendingRequests.filter((entry) => entry.id !== connectionId),
          contacts: nextContacts,
          contact_list: activeContactsUserId
            ? upsertContactsCache(contact_list, activeContactsUserId, nextContacts)
            : contact_list,
        });
      },

      optimisticDeclineRequest: (connectionId) => {
        set({
          pendingRequests: get().pendingRequests.filter(
            (request) => request.id !== connectionId
          ),
        });
      },

      optimisticSendConnection: () => {},

      fetchContacts: async (currentUserId: string) => {
        if (!currentUserId) {
          set({
            contacts: [],
            activeContactsUserId: null,
            isContactsLoading: false,
          });
          return;
        }

        const cachedContacts = get().contact_list[currentUserId] ?? [];
        set({
          activeContactsUserId: currentUserId,
          contacts: cachedContacts,
          isContactsLoading: cachedContacts.length === 0,
        });

        if (abortControllers.contacts) {
          abortControllers.contacts.abort();
        }

        const controller = new AbortController();
        abortControllers.contacts = controller;

        try {
          const supabase = createClient();
          const { data: connections, error: connectionError } = await supabase
            .from("connections")
            .select("requester_id, receiver_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
            .abortSignal(controller.signal);

          const connectionRows = (connections ?? []) as Array<{
            requester_id: string;
            receiver_id: string;
          }>;

          if (connectionError || connectionRows.length === 0) {
            if (!controller.signal.aborted) {
              set((state) => ({
                contacts: [],
                activeContactsUserId: currentUserId,
                contact_list: upsertContactsCache(state.contact_list, currentUserId, []),
                isContactsLoading: false,
              }));
            }
            return;
          }

          const otherIds = connectionRows.map((connection) =>
            connection.requester_id === currentUserId
              ? connection.receiver_id
              : connection.requester_id
          );

          // Only fetch public-facing columns to minimise PII on the wire
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", otherIds)
            .abortSignal(controller.signal);

          if (profileError) {
            if (!controller.signal.aborted) {
              set({ isContactsLoading: false });
            }
            return;
          }

          const nextContacts = (profiles ?? []) as PublicProfile[];
          if (!controller.signal.aborted) {
            set((state) => ({
              contacts: nextContacts,
              activeContactsUserId: currentUserId,
              contact_list: upsertContactsCache(
                state.contact_list,
                currentUserId,
                nextContacts
              ),
              isContactsLoading: false,
            }));
          }
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            set({ isContactsLoading: false });
          }
        }
      },

      fetchPendingRequests: async (currentUserId: string) => {
        if (abortControllers.requests) {
          abortControllers.requests.abort();
        }

        const controller = new AbortController();
        abortControllers.requests = controller;

        try {
          const supabase = createClient();
          const { data: connections, error: connectionError } = await supabase
            .from("connections")
            .select("id, requester_id")
            .eq("receiver_id", currentUserId)
            .eq("status", "pending")
            .abortSignal(controller.signal);

          const connectionRows = (connections ?? []) as Array<{
            id: string;
            requester_id: string;
          }>;

          if (connectionError || connectionRows.length === 0) {
            if (!controller.signal.aborted) {
              set({ pendingRequests: [], isRequestsLoading: false });
            }
            return;
          }

          const requesterIds = connectionRows.map((connection) => connection.requester_id);
          // Only fetch public-facing columns to minimise PII on the wire
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .in("id", requesterIds)
            .abortSignal(controller.signal);

          const profileRows = (profiles ?? []) as PublicProfile[];
          const merged = connectionRows
            .map((connection) => ({
              ...connection,
              profile: profileRows.find((profile) => profile.id === connection.requester_id) as
                | PublicProfile
                | undefined,
            }))
            .filter(
              (request): request is PendingRequest => request.profile !== undefined
            );

          if (!controller.signal.aborted) {
            set({ pendingRequests: merged, isRequestsLoading: false });
          }
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            set({ isRequestsLoading: false });
          }
        }
      },

      searchUsers: async (currentUserId: string, query: string) => {
        if (query.trim().length < 2) {
          set({ searchResults: [], isSearching: false });
          return;
        }

        if (abortControllers.search) {
          abortControllers.search.abort();
        }

        const controller = new AbortController();
        abortControllers.search = controller;
        set({ isSearching: true });

        try {
          const supabase = createClient();
          // Only fetch public-facing columns to minimise PII on the wire
          const { data, error } = await supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .ilike("username", `%${query.trim()}%`)
            .neq("id", currentUserId)
            .limit(10)
            .abortSignal(controller.signal);

          if (error) {
            if (!controller.signal.aborted) {
              set({ isSearching: false, searchResults: [] });
            }
            return;
          }

          if (!controller.signal.aborted) {
            // Fetch existing connections (accepted + pending) to exclude from results
            const { data: existingConnections } = await supabase
              .from("connections")
              .select("requester_id, receiver_id")
              .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
              .in("status", ["accepted", "pending"])
              .abortSignal(controller.signal);

            // Build a set of user IDs that already have a relationship with current user
            const connectedIds = new Set(
              (existingConnections ?? []).map((c: { requester_id: string; receiver_id: string }) =>
                c.requester_id === currentUserId ? c.receiver_id : c.requester_id
              )
            );

            // Only show users with no existing connection or pending request
            const filtered = (data ?? []).filter(
              (user: { id: string }) => !connectedIds.has(user.id)
            );

            set({ searchResults: filtered as PublicProfile[], isSearching: false });
          }
        } catch (error: unknown) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            set({ isSearching: false });
          }
        }
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        contact_list: state.contact_list,
        room_history: state.room_history,
      }),
      storage: createJSONStorage(() => indexedDbStateStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("useChatStore hydration failed", error);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export async function clearChatStoreData(): Promise<void> {
  useChatStore.getState().clearStore();
  useChatStore.persist.clearStorage();
  await clearChatIndexedDbData();
}
