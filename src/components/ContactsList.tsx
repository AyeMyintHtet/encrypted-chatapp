"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ConfirmationModal from "@/components/ConfirmationModal";
import type { UserPresence, Profile } from "@/lib/types";
import { Virtuoso } from "react-virtuoso";
import { useAppStore } from "@/store/useAppStore";
import { Trash2 } from "lucide-react";

interface ContactsListProps {
  currentUserId: string;
  presenceMap: Record<string, UserPresence>;
}

export default function ContactsList({ currentUserId, presenceMap }: ContactsListProps) {
  const supabase = createClient();
  const router = useRouter();

  // Local-first persistence
  const { contacts, isContactsLoading, optimisticClearContacts, optimisticRemoveContact } = useAppStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Profile | null>(null);
  const [, startTransition] = useTransition();

  /** Manually trigger peer's UI refetch via broadcast since Postgres DELETE drops WAL row payload */
  const notifyPeers = useCallback(
    (peerIds: string[]) => {
      peerIds.forEach((peerId) => {
        const channel = supabase.channel(`sync:${peerId}`);
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.send({
              type: "broadcast",
              event: "refresh_connections",
            });
            supabase.removeChannel(channel);
          }
        });
      });
    },
    [supabase]
  );

  /** Delete all accepted connections optimistically */
  const clearAllContacts = useCallback(async () => {
    const peersToNotify = contacts.map((c) => c.id);

    // 1. Instantly update UI synchronously within React transition
    startTransition(() => {
      optimisticClearContacts();
    });

    // 2. Perform background mutations elegantly with 1 single API call
    await supabase
      .from("connections")
      .delete()
      .eq("status", "accepted")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    // 3. Immediately inform peers to drop connections
    notifyPeers(peersToNotify);
  }, [currentUserId, supabase, optimisticClearContacts, contacts, notifyPeers]);

  /** Delete a specific contact optimistically */
  const removeContact = useCallback(async (contactId: string) => {
    startTransition(() => {
      optimisticRemoveContact(contactId);
    });

    // Use 1 single API call with explicit OR groupings
    await supabase
      .from("connections")
      .delete()
      .eq("status", "accepted")
      .or(`and(requester_id.eq.${currentUserId},receiver_id.eq.${contactId}),and(receiver_id.eq.${currentUserId},requester_id.eq.${contactId})`);

    notifyPeers([contactId]);
  }, [currentUserId, supabase, optimisticRemoveContact, notifyPeers]);

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

  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  // Only show shimmering skeletons if store is COMPLETELY empty on first load.
  // If we have cached contacts, we render immediately.
  if (isContactsLoading && contacts.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Contacts</h2>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>

      <h2 className="text-lg font-semibold mb-4 flex items-center justify-between" style={{ color: colors.textPrimary }}>
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
            onClick={() => setShowClearConfirm(true)}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer font-normal"
          >
            Clear All Contacts
          </button>
        )}
      </h2>

      {contacts.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: colors.textTertiary }}>No connections yet. Search for users to connect!</p>
      ) : (
        <div className="h-[400px]">
          <Virtuoso
            style={{ height: '100%' }}
            data={contacts}
            itemContent={(_, contact) => (
              <div className="py-1">
                <div
                  onClick={() => router.push(`/chat/${contact.username}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/chat/${contact.username}`) }}
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#09637E]/50"
                  style={{ background: colors.surfaceHover }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${getStatusColor(contact.id)}`}
                        style={{ borderColor: colors.surfaceHover }}
                        title={getStatusLabel(contact.id)}
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm" style={{ color: colors.textPrimary }}>{contact.name}</p>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>@{contact.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${getStatusLabel(contact.id) === "Active" ? "text-emerald-400" :
                      getStatusLabel(contact.id) === "Idle" ? "text-amber-400" : "text-gray-500"
                      }`}>
                      {getStatusLabel(contact.id)}
                    </span>
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-[#09637E] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>

                    {/* Delete button, shows on hover/focus */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContactToDelete(contact);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer shrink-0 ml-1"
                      title="Delete specific contact"
                      aria-label="Delete specific contact"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      )}

      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearAllContacts}
        title="Clear All Contacts"
        message="Are you sure you want to delete all your contacts? This action cannot be undone."
        confirmText="Clear All"
      />

      {/* Confirmation Modal for Individual Contact Deletion */}
      <ConfirmationModal
        isOpen={contactToDelete !== null}
        onClose={() => setContactToDelete(null)}
        onConfirm={() => {
          if (contactToDelete) {
            removeContact(contactToDelete.id);
            setContactToDelete(null);
          }
        }}
        title="Delete Contact"
        message={`Are you sure you want to delete ${contactToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
