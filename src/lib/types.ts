/**
 * Shared TypeScript types used across the application.
 */

/** Profile row from the `profiles` table */
export interface Profile {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  /** ISO timestamp when user requested account deletion (null = not scheduled) */
  deletion_scheduled_at: string | null;
  /** Grace period in days before permanent deletion (7, 30, or 90) */
  deletion_period_days: number | null;
}

/** Connection row from the `connections` table */
export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

/** Connection joined with profile data for display */
export interface ConnectionWithProfile extends Connection {
  profile: Profile; // the "other" user's profile
}

/** Chat message stored in localStorage and sent via Broadcast */
export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  timestamp: string;
}

/** Encrypted chat message payload for Broadcast + local persistence */
export interface EncryptedChatMessage {
  id: string;
  sender_id: string;
  timestamp: string;
  ciphertext: string;
  iv: string;
  algorithm: "AES-GCM";
  version: 1;
}

/** A row from the `pending_messages` table — encrypted payload stored server-side for offline delivery */
export interface PendingMessage {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  encrypted_payload: EncryptedChatMessage;
  created_at: string;
}

/** Presence status for a user */
export type PresenceStatus = "active" | "idle" | "offline";

/** Presence state tracked per user in Supabase Presence */
export interface UserPresence {
  user_id: string;
  username: string;
  status: PresenceStatus;
  last_seen: string;
}
