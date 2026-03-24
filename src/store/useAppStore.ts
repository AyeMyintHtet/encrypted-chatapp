import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Profile, ChatMessage } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

type ContactsByUser = Record<string, Profile[]>;

interface PendingRequest {
  id: string;
  requester_id: string;
  profile: Profile;
}

interface AppState {
  // Data
  contacts: Profile[];
  contactsByUser: ContactsByUser;
  activeContactsUserId: string | null;
  pendingRequests: PendingRequest[];
  searchResults: Profile[];
  messages: ChatMessage[];
  
  // Loading states
  isContactsLoading: boolean;
  isRequestsLoading: boolean;
  isSearching: boolean;
  
  // Actions
  setContacts: (currentUserId: string, contacts: Profile[]) => void;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSearchResults: (results: Profile[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  
  // Optimistic UI updates
  optimisticClearContacts: () => void;
  optimisticRemoveContact: (contactId: string) => void;
  optimisticAcceptRequest: (connectionId: string) => void;
  optimisticDeclineRequest: (connectionId: string) => void;
  optimisticSendConnection: (receiverId: string) => void;
  
  // Thunks / Fetchers with AbortController
  fetchContacts: (currentUserId: string) => Promise<void>;
  fetchPendingRequests: (currentUserId: string) => Promise<void>;
  searchUsers: (currentUserId: string, query: string) => Promise<void>;
  
  // Reset all state
  clearStore: () => void;
}

// Global abort controllers map for cancellation
const abortControllers: Record<string, AbortController> = {};

function upsertContactsCache(
  contactsByUser: ContactsByUser,
  currentUserId: string,
  contacts: Profile[]
): ContactsByUser {
  return {
    ...contactsByUser,
    [currentUserId]: contacts,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      contacts: [],
      contactsByUser: {},
      activeContactsUserId: null,
      pendingRequests: [],
      searchResults: [],
      messages: [],
      
      isContactsLoading: true, // true initally so we show skeletons if empty
      isRequestsLoading: true,
      isSearching: false,
      
      setContacts: (currentUserId, contacts) =>
        set((state) => ({
          contacts,
          activeContactsUserId: currentUserId,
          contactsByUser: upsertContactsCache(state.contactsByUser, currentUserId, contacts),
          isContactsLoading: false,
        })),
      setPendingRequests: (requests) => set({ pendingRequests: requests, isRequestsLoading: false }),
      setSearchResults: (results) => set({ searchResults: results, isSearching: false }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      
      clearStore: () => set({
        contacts: [],
        contactsByUser: {},
        activeContactsUserId: null,
        pendingRequests: [],
        searchResults: [],
        messages: [],
        isContactsLoading: true,
        isRequestsLoading: true,
        isSearching: false,
      }),

      optimisticClearContacts: () =>
        set((state) => {
          const currentUserId = state.activeContactsUserId;
          if (!currentUserId) {
            return { contacts: [] };
          }

          return {
            contacts: [],
            contactsByUser: upsertContactsCache(state.contactsByUser, currentUserId, []),
          };
        }),
      
      optimisticRemoveContact: (contactId) =>
        set((state) => {
          const currentUserId = state.activeContactsUserId;
          if (!currentUserId) return state;

          const nextContacts = state.contacts.filter((c) => c.id !== contactId);
          return {
            contacts: nextContacts,
            contactsByUser: upsertContactsCache(state.contactsByUser, currentUserId, nextContacts),
          };
        }),
      
      optimisticAcceptRequest: (connectionId) => {
        const { pendingRequests, contacts, activeContactsUserId, contactsByUser } = get();
        const request = pendingRequests.find((r) => r.id === connectionId);
        if (request) {
          const nextContacts = [...contacts, request.profile];
          // Add the requester profile to contacts optimistically
          // We filter out the accepted request from pendingRequests
          set({
            pendingRequests: pendingRequests.filter((r) => r.id !== connectionId),
            contacts: nextContacts,
            contactsByUser: activeContactsUserId
              ? upsertContactsCache(contactsByUser, activeContactsUserId, nextContacts)
              : contactsByUser,
          });
        }
      },
      
      optimisticDeclineRequest: (connectionId) => {
        set({
          pendingRequests: get().pendingRequests.filter((r) => r.id !== connectionId)
        });
      },
      
      optimisticSendConnection: () => {
        // Technically sending connection doesn't instantly append to local Search results
        // except keeping track of sent sets. So this could be handled locally per component.
        // We leave it purely component-level for search optimizations.
      },
      
      fetchContacts: async (currentUserId: string) => {
        if (!currentUserId) {
          set({
            contacts: [],
            activeContactsUserId: null,
            isContactsLoading: false,
          });
          return;
        }

        const cachedContacts = get().contactsByUser[currentUserId] ?? [];
        set({
          activeContactsUserId: currentUserId,
          contacts: cachedContacts,
          isContactsLoading: cachedContacts.length === 0,
        });

        if (abortControllers['contacts']) {
          abortControllers['contacts'].abort();
        }
        const controller = new AbortController();
        abortControllers['contacts'] = controller;
        
        try {
          const supabase = createClient();
          const { data: connections, error: connError } = await supabase
            .from("connections")
            .select("requester_id, receiver_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
            .abortSignal(controller.signal);
            
          const connectionRows = (connections ?? []) as Array<{
            requester_id: string;
            receiver_id: string;
          }>;

          if (connError || connectionRows.length === 0) {
            if (!controller.signal.aborted) {
              set((state) => ({
                contacts: [],
                activeContactsUserId: currentUserId,
                contactsByUser: upsertContactsCache(state.contactsByUser, currentUserId, []),
                isContactsLoading: false,
              }));
            }
            return;
          }
          
          const otherIds = connectionRows.map((c) =>
            c.requester_id === currentUserId ? c.receiver_id : c.requester_id
          );
          
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", otherIds)
            .abortSignal(controller.signal);
            
          if (profError) {
            if (!controller.signal.aborted) {
              set({ isContactsLoading: false });
            }
            return;
          }

          const nextContacts = (profiles ?? []) as Profile[];
          if (!controller.signal.aborted) {
            set((state) => ({
              contacts: nextContacts,
              activeContactsUserId: currentUserId,
              contactsByUser: upsertContactsCache(state.contactsByUser, currentUserId, nextContacts),
              isContactsLoading: false,
            }));
          }
        } catch (e: unknown) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) {
            set({ isContactsLoading: false });
          }
        }
      },
      
      fetchPendingRequests: async (currentUserId: string) => {
        if (abortControllers['requests']) {
          abortControllers['requests'].abort();
        }
        const controller = new AbortController();
        abortControllers['requests'] = controller;
        
        try {
          const supabase = createClient();
          const { data: connections, error: connError } = await supabase
            .from("connections")
            .select("id, requester_id")
            .eq("receiver_id", currentUserId)
            .eq("status", "pending")
            .abortSignal(controller.signal);
            
          const connectionRows = (connections ?? []) as Array<{
            id: string;
            requester_id: string;
          }>;

          if (connError || connectionRows.length === 0) {
            if (!controller.signal.aborted) set({ pendingRequests: [], isRequestsLoading: false });
            return;
          }
          
          const requesterIds = connectionRows.map((c) => c.requester_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", requesterIds)
            .abortSignal(controller.signal);
            
          const profileRows = (profiles ?? []) as Profile[];
          const merged = connectionRows.map((conn) => ({
            ...conn,
            profile: profileRows.find((p) => p.id === conn.requester_id) as Profile,
          })).filter(r => r.profile);
          
          if (!controller.signal.aborted) {
            set({ pendingRequests: merged, isRequestsLoading: false });
          }
        } catch (e: unknown) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) {
            set({ isRequestsLoading: false });
          }
        }
      },
      
      searchUsers: async (currentUserId: string, query: string) => {
        if (query.trim().length < 2) {
          set({ searchResults: [], isSearching: false });
          return;
        }
        
        if (abortControllers['search']) {
          abortControllers['search'].abort();
        }
        const controller = new AbortController();
        abortControllers['search'] = controller;
        
        set({ isSearching: true });
        
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
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
            set({ searchResults: (data ?? []) as Profile[], isSearching: false });
          }
        } catch (e: unknown) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) {
            set({ isSearching: false });
          }
        }
      }
    }),
    {
      name: 'CQgram-app-store',
      // Persist per-user contact snapshots only.
      // Runtime `contacts` stays in-memory and is hydrated per current user to
      // prevent cross-user contact leakage when accounts switch in one browser.
      // pendingRequests is intentionally excluded — it's transient data that
      // must always come fresh from the server to avoid stale-cache ghosts
      // (e.g. a request that was already accepted reappearing on hydration).
      partialize: (state) => ({
        contactsByUser: state.contactsByUser,
      }),
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return window.localStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }
  )
);
