import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasAcceptedConnection } from "@/lib/chat-access";
import { useRouter } from "next/navigation";
import type { Profile, PublicProfile } from "@/lib/types";
import { signOutAndClearClientState } from "@/lib/auth/clientSignOut";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Shared hook to fetch the current authenticated user's profile.
 * Cached globally to ensure instant loading across pages.
 */
export function useCurrentProfile() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUserProfileSnippet = useAuthStore(
    (state) => state.setUserProfileSnippet
  );

  return useQuery({
    queryKey: ["currentProfile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        throw new Error("Not logged in");
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Handle session expiration immediately
      if (error && (error.code === "406" || error.message?.includes("406"))) {
        await signOutAndClearClientState(queryClient);
        router.push("/login");
        throw new Error("Session expired");
      }

      if (error) {
        throw error;
      }

      setUserProfileSnippet({
        id: data.id,
        name: data.name,
        username: data.username,
        avatarUrl: data.avatar_url,
      });

      return data as Profile;
    },
  });
}

/**
 * Shared hook to fetch another user's profile by their username.
 */
export function usePeerProfile(username: string) {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      if (!username) throw new Error("No username provided");

      // Only fetch public-facing columns — no email, deletion, or created_at
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .eq("username", username)
        .single();

      if (error && (error.code === "406" || error.message?.includes("406"))) {
        await signOutAndClearClientState(queryClient);
        router.push("/login");
        throw new Error("Session expired");
      }

      if (error) {
        throw error;
      }

      return data as PublicProfile;
    },
    enabled: !!username, // Only run the query if a username is provided
  });
}

/**
 * Verifies whether the current user has an accepted connection with the peer.
 * Chat access should be granted only when this returns `true`.
 */
export function useCanChatWithPeer(currentUserId: string, peerUserId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["canChatWithPeer", currentUserId, peerUserId],
    queryFn: () => hasAcceptedConnection(supabase, currentUserId, peerUserId),
    enabled: Boolean(currentUserId && peerUserId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
