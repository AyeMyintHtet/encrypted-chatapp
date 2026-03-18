import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

/**
 * Shared hook to fetch the current authenticated user's profile.
 * Cached globally to ensure instant loading across pages.
 */
export function useCurrentProfile() {
  const supabase = createClient();
  const router = useRouter();

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
        await supabase.auth.signOut();
        document.cookie.split(";").forEach((c) => {
          document.cookie =
            c.trim().split("=")[0] +
            "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
        router.push("/login");
        throw new Error("Session expired");
      }

      if (error) {
        throw error;
      }

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

  return useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      if (!username) throw new Error("No username provided");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error && (error.code === "406" || error.message?.includes("406"))) {
        await supabase.auth.signOut();
        document.cookie.split(";").forEach((c) => {
          document.cookie =
            c.trim().split("=")[0] +
            "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
        router.push("/login");
        throw new Error("Session expired");
      }

      if (error) {
        throw error;
      }

      return data as Profile;
    },
    enabled: !!username, // Only run the query if a username is provided
  });
}
