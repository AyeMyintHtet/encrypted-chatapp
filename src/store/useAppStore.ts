import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Profile, ChatMessage } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface PendingRequest {
  id: string;
  requester_id: string;
  profile: Profile;
}

interface AppState {
  // Data
  contacts: Profile[];
  pendingRequests: PendingRequest[];
  searchResults: Profile[];
  messages: ChatMessage[];
  
  // Loading states
  isContactsLoading: boolean;
  isRequestsLoading: boolean;
  isSearching: boolean;
  
  // Actions
  setContacts: (contacts: Profile[]) => void;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setSearchResults: (results: Profile[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  
  // Optimistic UI updates
  optimisticClearContacts: () => void;
  optimisticAcceptRequest: (connectionId: string) => void;
  optimisticDeclineRequest: (connectionId: string) => void;
  optimisticSendConnection: (receiverId: string) => void;
  
  // Thunks / Fetchers with AbortController
  fetchContacts: (currentUserId: string) => Promise<void>;
  fetchPendingRequests: (currentUserId: string) => Promise<void>;
  searchUsers: (currentUserId: string, query: string) => Promise<void>;
}

// Global abort controllers map for cancellation
const abortControllers: Record<string, AbortController> = {};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      contacts: [],
      pendingRequests: [],
      searchResults: [],
      messages: [],
      
      isContactsLoading: true, // true initally so we show skeletons if empty
      isRequestsLoading: true,
      isSearching: false,
      
      setContacts: (contacts) => set({ contacts, isContactsLoading: false }),
      setPendingRequests: (requests) => set({ pendingRequests: requests, isRequestsLoading: false }),
      setSearchResults: (results) => set({ searchResults: results, isSearching: false }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      
      optimisticClearContacts: () => set({ contacts: [] }),
      
      optimisticAcceptRequest: (connectionId) => {
        const { pendingRequests, contacts } = get();
        const request = pendingRequests.find((r) => r.id === connectionId);
        if (request) {
          // Add the requester profile to contacts optimistically
          // We filter out the accepted request from pendingRequests
          set({
            pendingRequests: pendingRequests.filter((r) => r.id !== connectionId),
            contacts: [...contacts, request.profile],
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
            
          if (connError || !connections || connections.length === 0) {
            if (!controller.signal.aborted) set({ contacts: [], isContactsLoading: false });
            return;
          }
          
          const otherIds = connections.map((c: any) =>
            c.requester_id === currentUserId ? c.receiver_id : c.requester_id
          );
          
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", otherIds)
            .abortSignal(controller.signal);
            
          if (!controller.signal.aborted) {
            set({ contacts: profiles || [], isContactsLoading: false });
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
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
            
          if (connError || !connections || connections.length === 0) {
            if (!controller.signal.aborted) set({ pendingRequests: [], isRequestsLoading: false });
            return;
          }
          
          const requesterIds = connections.map((c: any) => c.requester_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", requesterIds)
            .abortSignal(controller.signal);
            
          const merged = connections.map((conn: any) => ({
            ...conn,
            profile: profiles?.find((p: any) => p.id === conn.requester_id) as Profile,
          })).filter(r => r.profile);
          
          if (!controller.signal.aborted) {
            set({ pendingRequests: merged, isRequestsLoading: false });
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
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
            
          if (!controller.signal.aborted) {
            set({ searchResults: data || [], isSearching: false });
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            set({ isSearching: false });
          }
        }
      }
    }),
    {
      name: 'kito-app-store',
      // Only persist contacts for instant first-paint.
      // pendingRequests is intentionally excluded — it's transient data that
      // must always come fresh from the server to avoid stale-cache ghosts
      // (e.g. a request that was already accepted reappearing on hydration).
      partialize: (state) => ({
        contacts: state.contacts,
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
