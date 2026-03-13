/**
 * Shared TypeScript types used across the application.
 */

/** Profile row from the `profiles` table */
export interface Profile {
  id: string;
  email: string;
  name: string;
  username: string;
  created_at: string;
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

/** Presence status for a user */
export type PresenceStatus = "active" | "idle" | "offline";

/** Presence state tracked per user in Supabase Presence */
export interface UserPresence {
  user_id: string;
  username: string;
  status: PresenceStatus;
  last_seen: string;
}
