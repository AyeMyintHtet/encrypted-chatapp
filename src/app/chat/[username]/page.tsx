"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocalChat } from "@/hooks/useLocalChat";
import { usePresence } from "@/hooks/usePresence";
import type { Profile, ChatMessage, PresenceStatus } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Chat page for a specific peer-to-peer conversation.
 * Uses Supabase Broadcast for real-time messaging and localStorage for persistence.
 */
export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const peerUsername = params.username as string;

  // State
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch both profiles in parallel
      const [currentRes, peerRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("profiles").select("*").eq("username", peerUsername).single(),
      ]);

      // 406 = session invalid/expired — sign out, clear cookies, redirect to login
      if (
        (currentRes.error && (currentRes.error.code === "406" || currentRes.error.message?.includes("406"))) ||
        (peerRes.error && (peerRes.error.code === "406" || peerRes.error.message?.includes("406")))
      ) {
        await supabase.auth.signOut();
        // Clear all Supabase auth cookies to fully reset session
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
        router.push("/login");
        return;
      }

      if (!currentRes.data || !peerRes.data) {
        router.push("/dashboard");
        return;
      }

      setCurrentProfile(currentRes.data);
      setPeerProfile(peerRes.data);
      setLoading(false);
    };

    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerUsername]);

  // Initialize chat hook once both profiles are loaded
  const { messages, addMessage, clearMessages } = useLocalChat(
    currentProfile?.id ?? "",
    peerProfile?.id ?? ""
  );

  // Initialize presence tracking — pass peerUsername so our status is "active"
  const { presenceMap } = usePresence(
    currentProfile?.id ?? "",
    currentProfile?.username ?? "",
    peerUsername // signals we are in this specific chat
  );

  /** Get peer's presence status */
  const getPeerStatus = (): PresenceStatus => {
    if (!peerProfile) return "offline";
    return presenceMap[peerProfile.id]?.status ?? "offline";
  };

  /** Scroll to the bottom of the messages list */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Set up Broadcast channel for real-time messaging
  useEffect(() => {
    if (!currentProfile || !peerProfile) return;

    // Create a deterministic channel name (sorted user IDs)
    const channelName = `chat_${[currentProfile.id, peerProfile.id].sort().join("_")}`;

    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, (payload) => {
        const incomingMessage = payload.payload as ChatMessage;
        // Only process messages from the peer (not our own echoes)
        if (incomingMessage.sender_id !== currentProfile.id) {
          addMessage(incomingMessage);

          // Play notification sound for incoming messages
          try {
            const audio = new Audio("/dragon-studio-notification-sound-effect-372475.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => { /* Autoplay blocked — ignore silently */ });
          } catch {
            // Audio playback not supported — ignore
          }
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id, peerProfile?.id]);

  /** Send a message via Broadcast and persist to localStorage */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentProfile || !channelRef.current) return;

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      sender_id: currentProfile.id,
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    // Persist locally first, then broadcast to peer
    addMessage(message);
    setInputValue("");

    await channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });
  };

  /** Handle Enter key to send message */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /** Format timestamp for display */
  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <svg className="animate-spin h-8 w-8 text-[#09637E]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!currentProfile || !peerProfile) return null;

  const peerStatus = getPeerStatus();
  const isPeerOffline = peerStatus === "offline";
  const statusColor =
    peerStatus === "active" ? "bg-emerald-500" :
      peerStatus === "idle" ? "bg-amber-500" : "bg-gray-500";
  const statusLabel =
    peerStatus === "active" ? "Active" :
      peerStatus === "idle" ? "Idle" : "Offline";

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br ">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#09637E]/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Chat header */}
      <header className="relative z-10 border-b border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Peer info with presence */}
            <div className="relative">
              <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {peerProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-950 ${statusColor}`} />
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">{peerProfile.name}</h1>
              <p className="text-gray-400 text-xs flex items-center gap-1">
                @{peerProfile.username}
                <span className="text-gray-600">·</span>
                <span className={
                  peerStatus === "active" ? "text-emerald-400" :
                    peerStatus === "idle" ? "text-amber-400" : "text-gray-500"
                }>
                  {statusLabel}
                </span>
              </p>
            </div>
          </div>

          {/* Clear All Chat button — only visible when there are messages */}
          {messages.length >= 1 && (
            <button
              onClick={clearMessages}
              className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer"
            >
              Clear All Chat
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <main className="relative z-10 flex-1 overflow-y-auto bg-[#1f4545]">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="w-16 h-16 bg-linear-to-br from-[#09637E]/20 to-[#088395]/20 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#09637E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white text-sm">No messages yet</p>
              <p className="text-white text-xs mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === currentProfile.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl ${isOwn
                      ? "bg-linear-to-r from-[#09637E] to-[#088395] text-white rounded-br-md"
                      : "bg-white/10 text-white rounded-bl-md"
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 text-white/60`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message input */}
      <footer className="relative z-10 border-t border-white/5 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Offline banner — show when peer is not in this chat */}
          {isPeerOffline && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-gray-800/60 border border-white/5 rounded-lg">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              <span className="text-gray-400 text-xs">
                {peerProfile.name} is offline — messages box will be open when he/his open this chat.
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isPeerOffline ? `${peerProfile.name} is offline...` : "Type a message..."}
              disabled={isPeerOffline}
              className={`flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all text-sm ${isPeerOffline ? "opacity-50 cursor-not-allowed" : ""}`}
              autoFocus
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isPeerOffline}
              className="p-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white rounded-xl transition-all shadow-lg shadow-[#09637E]/25 hover:shadow-[#09637E]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
