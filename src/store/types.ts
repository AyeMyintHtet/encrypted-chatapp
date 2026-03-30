import type { Profile } from "@/lib/types";

export type MessageStatus = "sending" | "sent" | "error";

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: string;
  status: MessageStatus;
}

export interface Auth {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface UserProfileSnippet {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export interface RoomHistoryEntry {
  roomId: string;
  lastMessageAt: string | null;
  messageCount: number;
}

export type RoomHistory = Record<string, RoomHistoryEntry>;
export type ContactsByUser = Record<string, Profile[]>;
