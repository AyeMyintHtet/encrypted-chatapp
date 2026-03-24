import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string;
  ip: string;
}

export function useUserSessions() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["userSessions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_sessions");
      if (error) {
        throw error;
      }
      return data as Session[];
    },
  });
}

export function useCurrentSessionId() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["currentSessionId"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      try {
        const base64Url = session.access_token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const payload = JSON.parse(jsonPayload);
        return payload.session_id as string;
      } catch {
        return null;
      }
    },
  });
}

export function useDeleteSession() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("delete_user_session", {
        session_id: sessionId,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSessions"] });
    },
  });
}
