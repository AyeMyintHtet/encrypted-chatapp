"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useDebounce } from "@/hooks/useDebounce";
import { useChatStore } from "@/store/useChatStore";
import UserAvatar from "@/components/UserAvatar";
interface SearchUsersProps {
  currentUserId: string;
}

/**
 * Search component: debounced username search with "Connect" action.
 * Searches the profiles table and allows sending connection requests.
 */
export default function SearchUsers({ currentUserId }: SearchUsersProps) {
  const supabase = createClient();
  const [query, setQuery] = useState("");

  const { searchResults: results, isSearching: searching, searchUsers } = useChatStore();
  const [, startTransition] = useTransition();

  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const debouncedQuery = useDebounce(query, 500);

  // Trigger search when debounced query changes
  useEffect(() => {
    searchUsers(currentUserId, debouncedQuery);
  }, [currentUserId, debouncedQuery, searchUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setMessage(null);
  };

  /** Send a connection request to a user */
  const handleConnect = async (receiverId: string) => {
    setMessage(null);
    setQuery("")
    // Optimistically update the sentRequests UI state within a transition
    startTransition(() => {
      setSentRequests((prev) => new Set(prev).add(receiverId));
    });

    // Check if a connection already exists between these users (Server-side validation)
    const { data: existingConnection } = await supabase
      .from("connections")
      .select("id, status")
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${currentUserId})`
      )
      .maybeSingle();

    if (existingConnection) {
      // Revert optimism
      startTransition(() => {
        setSentRequests((prev) => {
          const next = new Set(prev);
          next.delete(receiverId);
          return next;
        });
      });
      const statusText =
        existingConnection.status === "accepted" ? "already connected" : "already pending";
      setMessage({ type: "error", text: `You are ${statusText} with this user` });
      return;
    }

    // Insert the pending connection request
    const { error } = await supabase.from("connections").insert({
      requester_id: currentUserId,
      receiver_id: receiverId,
      status: "pending",
    });

    if (error) {
      // Revert optimism
      startTransition(() => {
        setSentRequests((prev) => {
          const next = new Set(prev);
          next.delete(receiverId);
          return next;
        });
      });
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Connection request sent!" });
      setTimeout(() => {
        setMessage(null)
      }, 2000)
    }
  };

  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
        <svg className="w-5 h-5 text-[#09637E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Find People
      </h2>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search by username..."
          className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all"
          style={{ background: colors.inputBg, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-[#09637E]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div className={`mt-3 p-2.5 rounded-lg text-sm ${message.type === "success"
          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>
          {message.text}
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-xl transition-colors"
              style={{ background: colors.surfaceHover }}
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatar_url}
                  size={40}
                  textClassName="text-sm"
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: colors.textPrimary }}>{user.name}</p>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>@{user.username}</p>
                </div>
              </div>
              <button
                onClick={() => handleConnect(user.id)}
                disabled={sentRequests.has(user.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${sentRequests.has(user.id)
                  ? "bg-white/10 text-gray-400 cursor-not-allowed"
                  : "bg-[#09637E] hover:bg-[#088395] text-white shadow-lg shadow-[#09637E]/25"
                  }`}
              >
                {sentRequests.has(user.id) ? "Sent" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="mt-4 text-sm text-center" style={{ color: colors.textTertiary }}>No users found</p>
      )}
    </div>
  );
}
