"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

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
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /** Search profiles by username (case-insensitive partial match) */
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      setMessage(null);

      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${searchQuery.trim()}%`)
        .neq("id", currentUserId) // exclude self
        .limit(10);

      if (error) {
        setMessage({ type: "error", text: "Failed to search users" });
      } else {
        setResults(data || []);
      }
      setSearching(false);
    },
    [currentUserId, supabase]
  );

  /** Send a connection request to a user */
  const handleConnect = async (receiverId: string) => {
    setMessage(null);

    // Check if a connection already exists between these users
    const { data: existingConnection } = await supabase
      .from("connections")
      .select("id, status")
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${currentUserId})`
      )
      .single();

    if (existingConnection) {
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
      setMessage({ type: "error", text: error.message });
    } else {
      setSentRequests((prev) => new Set(prev).add(receiverId));
      setMessage({ type: "success", text: "Connection request sent!" });
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by username..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all"
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
        <div className={`mt-3 p-2.5 rounded-lg text-sm ${
          message.type === "success"
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
              className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{user.name}</p>
                  <p className="text-gray-400 text-xs">@{user.username}</p>
                </div>
              </div>
              <button
                onClick={() => handleConnect(user.id)}
                disabled={sentRequests.has(user.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  sentRequests.has(user.id)
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
        <p className="mt-4 text-gray-500 text-sm text-center">No users found</p>
      )}
    </div>
  );
}
