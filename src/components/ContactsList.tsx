"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserPresence } from "@/lib/types";

interface ContactsListProps {
  currentUserId: string;
  presenceMap: Record<string, UserPresence>;
}

/**
 * Displays the user's accepted contacts with their presence status.
 * Clicking a contact navigates to the chat route.
 */
export default function ContactsList({ currentUserId, presenceMap }: ContactsListProps) {
  const supabase = createClient();
  const router = useRouter();

  const [contacts, setContacts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  /** Fetch accepted connections and resolve the "other" user's profile */
  const fetchContacts = async () => {
    // Get accepted connections involving the current user
    const { data: connections } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (!connections || connections.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Extract the IDs of the "other" users
    const otherIds = connections.map((c) =>
      c.requester_id === currentUserId ? c.receiver_id : c.requester_id
    );

    // Fetch their profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", otherIds);

    setContacts(profiles || []);
    setLoading(false);
  };

  /** Delete all accepted connections for the current user */
  const clearAllContacts = useCallback(async () => {
    // Delete rows where user is the requester
    await supabase
      .from("connections")
      .delete()
      .eq("status", "accepted")
      .eq("requester_id", currentUserId);

    // Delete rows where user is the receiver
    await supabase
      .from("connections")
      .delete()
      .eq("status", "accepted")
      .eq("receiver_id", currentUserId);

    // Clear local state immediately
    setContacts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    fetchContacts();

    // Subscribe to connection status changes (e.g., new acceptance)
    const channel = supabase
      .channel("contacts-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "connections",
        },
        () => {
          fetchContacts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "connections",
        },
        () => {
          // Re-fetch when any connection is deleted (e.g., peer cleared contacts)
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  /** Get presence status dot color */
  const getStatusColor = (userId: string): string => {
    const presence = presenceMap[userId];
    if (!presence) return "bg-gray-500"; // offline
    switch (presence.status) {
      case "active":
        return "bg-emerald-500";
      case "idle":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  /** Get human-readable status label */
  const getStatusLabel = (userId: string): string => {
    const presence = presenceMap[userId];
    if (!presence) return "Offline";
    switch (presence.status) {
      case "active":
        return "Active";
      case "idle":
        return "Idle";
      default:
        return "Offline";
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Contacts</h2>
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
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Contacts
          {contacts.length > 0 && (
            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full font-medium">
              {contacts.length}
            </span>
          )}
        </div>
        {/* Clear All Contacts — only visible when there are contacts */}
        {contacts.length >= 1 && (
          <button
            onClick={clearAllContacts}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer font-normal"
          >
            Clear All Contacts
          </button>
        )}
      </h2>

      {contacts.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No connections yet. Search for users to connect!</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => router.push(`/chat/${contact.username}`)}
              className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {/* Avatar with status indicator */}
                <div className="relative">
                  <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${getStatusColor(contact.id)}`}
                    title={getStatusLabel(contact.id)}
                  />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium text-sm">{contact.name}</p>
                  <p className="text-gray-400 text-xs">@{contact.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${getStatusLabel(contact.id) === "Active" ? "text-emerald-400" :
                  getStatusLabel(contact.id) === "Idle" ? "text-amber-400" : "text-gray-500"
                  }`}>
                  {getStatusLabel(contact.id)}
                </span>
                <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
