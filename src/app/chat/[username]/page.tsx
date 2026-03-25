"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ArrowRightCircle, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  cachePeerPublicKeyJwk,
  deriveConversationKey,
  getCachedPeerPublicKeyJwk,
  getOrCreateIdentityKeyPair,
  importPeerPublicKey,
} from "@/lib/crypto/e2ee";
import { useLocalChat } from "@/hooks/useLocalChat";
import { usePresence } from "@/hooks/usePresence";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import {
  useCanChatWithPeer,
  useCurrentProfile,
  usePeerProfile,
} from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ThemeToggle from "@/components/ThemeToggle";
import UserAvatar from "@/components/UserAvatar";
import type { ChatMessage, EncryptedChatMessage, PresenceStatus } from "@/lib/types";
import { sendPushNotification } from "@/lib/onesignal/notify";

/**
 * Lazy-loaded components — split into separate JS chunks.
 *
 * ConfirmationModal: Only rendered when user taps "Clear Chat" — pure interaction-driven.
 * TypingIndicator: Only rendered when peer is actively typing — conditional render.
 */
const ConfirmationModal = dynamic(() => import("@/components/ConfirmationModal"));

const TypingIndicator = dynamic(() => import("@/components/TypingIndicator"));

type KeyRequestPayload = {
  sender_id: string;
  timestamp: string;
};

type KeyAnnouncePayload = {
  sender_id: string;
  timestamp: string;
  public_key: JsonWebKey;
};

/**
 * Chat page for a specific peer-to-peer conversation.
 * Uses Web Crypto (ECDH + AES-GCM) for end-to-end encryption of:
 * - Supabase Broadcast message payloads
 * - Local chat persistence in localStorage
 */
export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const peerUsername = params.username as string;

  // Fetch profiles globally via React Query
  const { data: currentProfile, isLoading: currentLoading } = useCurrentProfile();
  const { data: peerProfile, isLoading: peerLoading } = usePeerProfile(peerUsername);
  const currentUserId = currentProfile?.id ?? "";
  const peerUserId = peerProfile?.id ?? "";
  const watchedPresenceUserIds = useMemo(
    () => (peerUserId ? [peerUserId] : []),
    [peerUserId]
  );
  const shouldCheckRelationship = Boolean(currentUserId && peerUserId);
  const {
    data: canChatWithPeer,
    isLoading: relationshipLoading,
    error: relationshipError,
  } = useCanChatWithPeer(currentUserId, peerUserId);
  const loading =
    currentLoading ||
    peerLoading ||
    (shouldCheckRelationship && relationshipLoading);
  const isAccessDenied = Boolean(
    !loading &&
    currentProfile &&
    peerProfile &&
    (canChatWithPeer === false || relationshipError)
  );

  // State
  const [inputValue, setInputValue] = useState("");
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [secureChannelError, setSecureChannelError] = useState<string | null>(null);
  // State-based channel ref so hooks like useTypingIndicator re-evaluate when the channel is created
  const [activeChannel, setActiveChannel] = useState<import("@supabase/supabase-js").RealtimeChannel | null>(null);

  // Refs
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<import("@supabase/supabase-js").RealtimeChannel | null>(null);
  const privateKeyRef = useRef<CryptoKey | null>(null);

  // Initialize chat hook once both profiles are loaded
  const { messages, addOutgoingMessage, addIncomingEncryptedMessage, clearMessages } = useLocalChat(
    currentUserId,
    peerUserId,
    conversationKey
  );
  const addIncomingEncryptedMessageRef = useRef(addIncomingEncryptedMessage);

  useEffect(() => {
    addIncomingEncryptedMessageRef.current = addIncomingEncryptedMessage;
  }, [addIncomingEncryptedMessage]);

  // Initialize presence tracking — pass peerUsername so our status is "active"
  const { presenceMap } = usePresence(
    currentProfile?.id ?? "",
    currentProfile?.username ?? "",
    peerUsername,
    watchedPresenceUserIds
  );

  // Typing indicator — piggybacks on the existing Broadcast channel
  const { isPeerTyping, notifyTyping } = useTypingIndicator(
    activeChannel,
    currentUserId
  );

  /** Get peer's presence status */
  const getPeerStatus = (): PresenceStatus => {
    if (!peerProfile) return "offline";
    return presenceMap[peerProfile.id]?.status ?? "offline";
  };

  const isSecureChannelReady = Boolean(conversationKey);

  /** Scroll to the bottom of the messages list */
  const scrollToBottom = useCallback(
    (behavior: "smooth" | "auto" = "smooth") => {
      if (messages.length === 0) return;
      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        align: "end",
        behavior,
      });
    },
    [messages.length]
  );

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  // Guard `/chat/[username]` by accepted relationship.
  useEffect(() => {
    if (!isAccessDenied) return;
    router.replace("/dashboard?error=chat_access_denied");
  }, [isAccessDenied, router]);

  // Keep chat viewport aligned with the visible mobile area when keyboard opens.
  // iOS Safari scrolls the document body when the keyboard appears, so we
  // force-reset scroll position and use visualViewport.offsetTop to stay pinned.
  useEffect(() => {
    const updateViewportHeight = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        setViewportHeight(`${Math.round(vv.height)}px`);

        // iOS scrolls the page behind the app when the keyboard opens.
        // Pin it back to the top so our fixed layout stays visible.
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        return;
      }
      setViewportHeight(`${window.innerHeight}px`);
    };

    updateViewportHeight();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateViewportHeight);
    vv?.addEventListener("scroll", updateViewportHeight);
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);

    return () => {
      vv?.removeEventListener("resize", updateViewportHeight);
      vv?.removeEventListener("scroll", updateViewportHeight);
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    scrollToBottom("auto");
  }, [viewportHeight, scrollToBottom]);

  // Initialize local identity keypair and restore cached peer key.
  useEffect(() => {
    if (!currentUserId || !peerUserId || loading || canChatWithPeer !== true) return;
    let isMounted = true;

    const initializeKeys = async () => {
      try {
        const identity = await getOrCreateIdentityKeyPair(currentUserId);
        if (!isMounted) return;

        privateKeyRef.current = identity.privateKey;
        setPublicKeyJwk(identity.publicKeyJwk);
        setSecureChannelError(null);

        const cachedPeerJwk = getCachedPeerPublicKeyJwk(
          currentUserId,
          peerUserId
        );
        if (!cachedPeerJwk) {
          setConversationKey(null);
          return;
        }

        const peerPublicKey = await importPeerPublicKey(cachedPeerJwk);
        const derivedKey = await deriveConversationKey(
          identity.privateKey,
          peerPublicKey
        );
        if (!isMounted) return;
        setConversationKey(derivedKey);
      } catch {
        if (!isMounted) return;
        setConversationKey(null);
        setSecureChannelError("Secure channel setup failed on this device.");
      }
    };

    void initializeKeys();
    return () => {
      isMounted = false;
      privateKeyRef.current = null;
    };
  }, [canChatWithPeer, currentUserId, loading, peerUserId]);

  // Set up Broadcast channel for real-time encrypted messaging + key exchange.
  useEffect(() => {
    if (
      !currentUserId ||
      !peerUserId ||
      loading ||
      canChatWithPeer !== true ||
      !publicKeyJwk
    ) return;
    if (!privateKeyRef.current) return;

    // Create a deterministic channel name (sorted user IDs)
    const channelName = `chat_${[currentUserId, peerUserId].sort().join("_")}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const sendKeyRequest = async () => {
      if (!channelRef.current) return;
      const payload: KeyRequestPayload = {
        sender_id: currentUserId,
        timestamp: new Date().toISOString(),
      };

      await channelRef.current.send({
        type: "broadcast",
        event: "key_request",
        payload,
      });
    };

    const sendKeyAnnouncement = async () => {
      if (!channelRef.current) return;
      const payload: KeyAnnouncePayload = {
        sender_id: currentUserId,
        public_key: publicKeyJwk,
        timestamp: new Date().toISOString(),
      };

      await channelRef.current.send({
        type: "broadcast",
        event: "key_announce",
        payload,
      });
    };

    const handlePeerKeyAnnouncement = async (payload: KeyAnnouncePayload) => {
      if (payload.sender_id === currentUserId) return;

      try {
        cachePeerPublicKeyJwk(currentUserId, peerUserId, payload.public_key);
        if (!privateKeyRef.current) return;

        const peerPublicKey = await importPeerPublicKey(payload.public_key);
        const derivedKey = await deriveConversationKey(
          privateKeyRef.current,
          peerPublicKey
        );

        setConversationKey(derivedKey);
        setSecureChannelError(null);
      } catch {
        setSecureChannelError("Could not establish an encrypted channel.");
      }
    };

    channel
      .on("broadcast", { event: "key_request" }, (payload) => {
        const request = payload.payload as KeyRequestPayload;
        if (request.sender_id !== currentUserId) {
          void sendKeyAnnouncement();
        }
      })
      .on("broadcast", { event: "key_announce" }, (payload) => {
        const announcement = payload.payload as KeyAnnouncePayload;
        void handlePeerKeyAnnouncement(announcement);
      })
      .on("broadcast", { event: "message" }, (payload) => {
        const incomingMessage = payload.payload as EncryptedChatMessage;
        // Only process messages from the peer (not our own echoes)
        if (incomingMessage.sender_id !== currentUserId) {
          void addIncomingEncryptedMessageRef.current(incomingMessage);

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setActiveChannel(channel);
          void sendKeyAnnouncement();
          void sendKeyRequest();
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setActiveChannel(null);
    };
  }, [
    canChatWithPeer,
    currentUserId,
    loading,
    peerUserId,
    publicKeyJwk,
    supabase,
  ]);

  /** Send an encrypted message via Broadcast and persist encrypted content locally */
  const handleSendMessage = async () => {
    if (
      !inputValue.trim() ||
      !currentProfile ||
      !channelRef.current ||
      !conversationKey
    ) {
      return;
    }

    const message: ChatMessage = {
      id: createMessageId(),
      sender_id: currentProfile.id,
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const encryptedMessage = await addOutgoingMessage(message);
      if (!encryptedMessage) {
        setSecureChannelError("Encrypted channel is not ready yet.");
        return;
      }

      await channelRef.current.send({
        type: "broadcast",
        event: "message",
        payload: encryptedMessage,
      });
      setInputValue("");
      setSecureChannelError(null);

      // Send push for every outgoing message so receiver gets background notifications.
      if (peerProfile?.id) {
        const webUrl = `${window.location.origin}/chat/${currentProfile.username}`;
        void sendPushNotification({
          receiverId: peerProfile.id,
          senderName: currentProfile.name,
          webUrl,
        });
      }

    } catch {
      setSecureChannelError("Unable to encrypt and send this message.");
    }
  };

  /** Handle Enter key to send message */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputFocus = () => {
    // iOS scrolls the body when focusing an input. Reset scroll and
    // re-align the chat list after a short delay for the keyboard animation.
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.setTimeout(() => {
      window.scrollTo(0, 0);
      scrollToBottom("auto");
    }, 120);
  };


  /** Lightweight message ID generator for local chat messages */
  const createMessageId = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `msg_${crypto.randomUUID()}`;
    }
    const timePart = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `msg_${timePart}_${randomPart}`;
  };

  /** Format timestamp for display */
  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = THEME_CONFIG[theme as ThemeType];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
        <svg className="animate-spin h-8 w-8 text-[#09637E]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          Redirecting to dashboard...
        </p>
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
  const isComposerDisabled = isPeerOffline || !isSecureChannelReady;

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: colors.backgroundSolid, height: viewportHeight }}
    >
      {/* Ambient background glow */}
      {isDark && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow1 }} />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow2 }} />
        </div>
      )}

      {/* Chat header */}
      <header className="relative z-10 shrink-0 backdrop-blur-md" style={{ background: isDark ? "rgba(3,7,18,0.8)" : "rgba(239,233,227,0.8)", borderBottom: `1px solid ${colors.borderMuted}` }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 rounded-lg transition-colors cursor-pointer"
              style={{ background: colors.surface }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: colors.textSecondary }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Peer info with presence */}
            <div className="relative shrink-0">
              <UserAvatar
                name={peerProfile.name}
                avatarUrl={peerProfile.avatar_url}
                size={32}
                className="sm:w-10! sm:h-10!"
                textClassName="text-xs sm:text-sm"
              />
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 ${statusColor}`} style={{ borderColor: isDark ? colors.backgroundSolid : colors.surface }} />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-xs sm:text-sm truncate" style={{ color: colors.textPrimary }}>{peerProfile.name}</h1>
              <p className="text-[10px] sm:text-xs flex items-center gap-1" style={{ color: colors.textTertiary }}>
                <span className="truncate hidden sm:inline">@{peerProfile.username}</span>
                <span className="hidden sm:inline" style={{ color: colors.borderMuted }}>·</span>
                <span className={
                  peerStatus === "active" ? "text-emerald-400" :
                    peerStatus === "idle" ? "text-amber-400" : "text-gray-500"
                }>
                  {statusLabel}
                </span>
                <span className="hidden sm:inline" style={{ color: colors.borderMuted }}>·</span>
                <span className={isSecureChannelReady ? "text-cyan-400" : "text-amber-400"}>
                  {isSecureChannelReady ? "Encrypted" : "Securing..."}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Clear All Chat button — only visible when there are messages */}
            {messages.length >= 1 && (
              <button
                onClick={() => setShowClearChatConfirm(true)}
                aria-label="Clear all chat"
                title="Clear all chat"
                className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden overscroll-contain" style={{ background: isDark ? "#111827" : colors.surface }}>
        {messages.length === 0 ? (
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="flex flex-col items-center justify-center h-full min-h-[250px] sm:min-h-[300px] text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-linear-to-br from-[#09637E]/20 to-[#088395]/20 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#09637E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs sm:text-sm" style={{ color: colors.textPrimary }}>No messages yet</p>
              <p className="text-[10px] sm:text-xs mt-1" style={{ color: colors.textTertiary }}>Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className="h-full"
            data={messages}
            followOutput="smooth"
            overscan={200}
            itemContent={(_, msg) => {
              const isOwn = msg.sender_id === currentProfile.id;
              return (
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-1.5 sm:py-2">
                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl ${isOwn
                        ? "bg-linear-to-r from-[#09637E] to-[#088395] text-white rounded-br-md shadow-sm"
                        : "rounded-bl-md shadow-xs"
                        }`}
                      style={!isOwn ? { background: colors.surfaceHover, color: colors.textPrimary } : {}}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <p className={`text-[9px] sm:text-[10px] mt-1 text-right sm:text-left ${isOwn ? "text-white/60" : ""}`} style={!isOwn ? { color: colors.textSecondary } : {}}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </main>

      {/* Typing indicator — appears above the input when peer is typing */}
      {isPeerTyping && (
        <div className="relative z-10 shrink-0" style={{ background: isDark ? "#111827" : colors.surface }}>
          <TypingIndicator peerName={peerProfile.name} />
        </div>
      )}

      {/* Message input */}
      <footer className="safe-bottom-area relative z-10 shrink-0 backdrop-blur-md" style={{ background: isDark ? "rgba(3,7,18,0.8)" : "rgba(239,233,227,0.8)", borderTop: `1px solid ${colors.borderMuted}` }}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {!isSecureChannelReady && !secureChannelError && (
            <div className="mb-2 sm:mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full" />
              <span className="text-[10px] sm:text-xs text-amber-300">
                Establishing end-to-end encrypted channel with {peerProfile.name}...
              </span>
            </div>
          )}
          {secureChannelError && (
            <div className="mb-2 sm:mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-400 rounded-full" />
              <span className="text-[10px] sm:text-xs text-red-300">
                {secureChannelError}
              </span>
            </div>
          )}
          {/* Offline banner — show when peer is not in this chat */}
          {isPeerOffline && (
            <div className="mb-2 sm:mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: colors.surface, border: `1px solid ${colors.borderMuted}` }}>
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-500 rounded-full" />
              <span className="text-[10px] sm:text-xs" style={{ color: colors.textSecondary }}>
                {peerProfile.name} is offline — send is disabled until they reconnect.
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Broadcast typing indicator on every keystroke
                if (e.target.value.trim()) notifyTyping();
              }}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              placeholder={
                secureChannelError
                  ? "Secure channel unavailable..."
                  : !isSecureChannelReady
                    ? "Setting up end-to-end encryption..."
                    : isPeerOffline
                      ? `${peerProfile.name} is offline...`
                      : "Type a message..."
              }
              readOnly={isComposerDisabled}
              enterKeyHint="send"
              className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all text-xs sm:text-sm ${isComposerDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              style={{ background: colors.inputBg, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
            />
            <button
              onClick={handleSendMessage}
              onPointerDown={(e) => {
                e.preventDefault();
              }}
              disabled={!inputValue.trim() || isComposerDisabled}
              className="p-2.5 sm:p-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white rounded-xl transition-all shadow-lg shadow-[#09637E]/25 hover:shadow-[#09637E]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowRightCircle />
            </button>
          </div>
        </div>
      </footer>

      <ConfirmationModal
        isOpen={showClearChatConfirm}
        onClose={() => setShowClearChatConfirm(false)}
        onConfirm={clearMessages}
        title="Clear Chat History"
        message={`Are you sure you want to clear your chat history with ${peerProfile.name}? This will only clear the messages locally on your device.`}
        confirmText="Clear Chat"
      />
    </div>
  );
}
