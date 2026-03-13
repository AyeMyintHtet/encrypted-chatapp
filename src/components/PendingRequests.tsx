"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface PendingRequestsProps {
  currentUserId: string;
}

/**
 * Realtime-updated list of incoming connection requests.
 * Subscribes to Supabase Realtime for INSERT events on the connections table
 * where the current user is the receiver.
 */
export default function PendingRequests({ currentUserId }: PendingRequestsProps) {
  const supabase = createClient();

  interface PendingRequest {
    id: string;
    requester_id: string;
    profile: Profile;
  }

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  /** Fetch pending requests with requester profile data */
  const fetchRequests = async () => {
    // Fetch pending connections where current user is the receiver
    const { data: connections } = await supabase
      .from("connections")
      .select("id, requester_id")
      .eq("receiver_id", currentUserId)
      .eq("status", "pending");

    if (!connections || connections.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all requesters
    const requesterIds = connections.map((c) => c.requester_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", requesterIds);

    // Merge connection data with profile data
    const merged = connections.map((conn) => ({
      ...conn,
      profile: profiles?.find((p) => p.id === conn.requester_id) as Profile,
    }));

    setRequests(merged.filter((r) => r.profile));
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime INSERT events on connections table
    const channel = supabase
      .channel("pending-requests")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connections",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          // Re-fetch on new request to get full profile data
          fetchRequests();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "connections",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  /** Accept a connection request */
  const handleAccept = async (connectionId: string) => {
    await supabase
      .from("connections")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", connectionId);

    // Remove from local state
    setRequests((prev) => prev.filter((r) => r.id !== connectionId));
  };

  /** Decline (delete) a connection request */
  const handleDecline = async (connectionId: string) => {
    await supabase.from("connections").delete().eq("id", connectionId);
    setRequests((prev) => prev.filter((r) => r.id !== connectionId));
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Pending Requests</h2>
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-[#09637E]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Pending Requests
        {requests.length > 0 && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium">
            {requests.length}
          </span>
        )}
      </h2>

      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No pending requests</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {req.profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{req.profile.name}</p>
                  <p className="text-gray-400 text-xs">@{req.profile.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(req.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(req.id)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
