"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ArrowRightCircle, Users, Copy, Check, Menu, X, Link2, Trash2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ThemeToggle from "@/components/ThemeToggle";
import dynamic from "next/dynamic";

const ConfirmationModal = dynamic(() => import("@/components/ConfirmationModal"));

type QuickChatUser = {
  id: string;
  name: string;
  username: string;
  status: "active" | "idle";
  joined_at: string;
};

type QuickChatMessage = {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_username: string;
  timestamp: string;
};

const IDLE_TIMEOUT_MS = 60 * 1000;

export default function QuickChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const supabase = useMemo(() => createClient(), []);

  const { data: currentProfile, isLoading: profileLoading } = useCurrentProfile();

  const [messages, setMessages] = useState<QuickChatMessage[]>([]);
  const [participants, setParticipants] = useState<Record<string, QuickChatUser>>({});
  const [inputValue, setInputValue] = useState("");
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const channelRef = useRef<import("@supabase/supabase-js").RealtimeChannel | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = THEME_CONFIG[theme as ThemeType];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error("Failed to copy link");
    }
  };

  const scrollToBottom = useCallback((behavior: "smooth" | "auto" = "smooth") => {
    if (messages.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: "end",
      behavior,
    });
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  // Keep chat viewport aligned with the visible mobile area when keyboard opens.
  useEffect(() => {
    const updateViewportHeight = () => {
      if (window.visualViewport) {
        setViewportHeight(`${Math.round(window.visualViewport.height)}px`);
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

  useEffect(() => {
    if (!currentProfile || !chatId) return;
    const verifyChat = async () => {
      const realId = chatId.replace('otc-', '');
      const { data, error } = await supabase
        .from('quick_chats')
        .select('*')
        .eq('id', realId)
        .single();
        
      if (error || !data || data.is_destroyed || new Date(data.expires_at) < new Date()) {
        router.replace('/dashboard?error=chat_access_denied');
        return;
      }
      
      setIsCreator(data.creator_id === currentProfile.id);
      setIsVerifying(false);
    };
    verifyChat();
  }, [chatId, currentProfile, supabase, router]);

  useEffect(() => {
    if (profileLoading || !currentProfile || isVerifying) return;

    const channel = supabase.channel(`quick_chat_${chatId}`, {
      config: {
        presence: { key: currentProfile.id },
      },
    });

    channelRef.current = channel;

    const trackStatus = (status: "active" | "idle") => {
      channel.track({
        id: currentProfile.id,
        name: currentProfile.name,
        username: currentProfile.username,
        status,
        joined_at: new Date().toISOString()
      });
    };

    const resetIdleTimer = () => {
      trackStatus("active");
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        trackStatus("idle");
      }, IDLE_TIMEOUT_MS);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<QuickChatUser>();
        const newParticipants: Record<string, QuickChatUser> = {};

        Object.keys(state).forEach((key) => {
          // Get the latest presence state for this user
          const presences = state[key];
          if (presences.length > 0) {
            newParticipants[key] = presences[presences.length - 1];
          }
        });

        setParticipants(newParticipants);
      })
      .on("broadcast", { event: "message" }, (payload) => {
        const incoming = payload.payload as QuickChatMessage;
        setMessages((prev) => [...prev, incoming]);

        // Notification sound
        if (incoming.sender_id !== currentProfile.id) {
          try {
            const audio = new Audio("/dragon-studio-notification-sound-effect-372475.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => { });
          } catch { }
        }
      })
      .on("broadcast", { event: "destroyed" }, () => {
        router.replace("/dashboard");
      })
      .on("broadcast", { event: "clear_messages" }, (payload) => {
        const { user_id } = payload.payload;
        setMessages((prev) => prev.filter(m => m.sender_id !== user_id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resetIdleTimer();
        }
      });

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      activityEvents.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [chatId, currentProfile, profileLoading, isVerifying, supabase, router]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !currentProfile || !channelRef.current) return;

    const msg: QuickChatMessage = {
      id: crypto.randomUUID(),
      content: inputValue.trim(),
      sender_id: currentProfile.id,
      sender_name: currentProfile.name,
      sender_username: currentProfile.username,
      timestamp: new Date().toISOString(),
    };

    // Add locally
    setMessages((prev) => [...prev, msg]);
    // Broadcast to others
    channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: msg,
    });
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDestroy = async () => {
    const realId = chatId.replace('otc-', '');
    await supabase.from('quick_chats').update({ is_destroyed: true }).eq('id', realId);
    channelRef.current?.send({ type: 'broadcast', event: 'destroyed', payload: {} });
    router.replace('/dashboard');
  };

  const handleClearMessages = () => {
    setMessages(prev => prev.filter(m => m.sender_id !== currentProfile?.id));
    channelRef.current?.send({ type: 'broadcast', event: 'clear_messages', payload: { user_id: currentProfile?.id } });
    setShowClearModal(false);
  };

  if (profileLoading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.background }}>
        <svg className="animate-spin h-8 w-8 text-[#09637E]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!currentProfile) {
    router.push("/login");
    return null;
  }

  const participantsList = Object.values(participants);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: colors.backgroundSolid, height: viewportHeight }}>
      {/* Background elements */}
      {isDark && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow1 }} />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow2 }} />
        </div>
      )}

      {/* Sidebar for Desktop / Hidden on Mobile unless toggled */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 md:relative transform transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col backdrop-blur-md ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          background: isDark ? "rgba(3,7,18,0.8)" : "rgba(239,233,227,0.8)",
          borderRight: `1px solid ${colors.borderMuted}`
        }}
      >
        <div className="p-4 border-b border-opacity-20 flex items-center justify-between" style={{ borderColor: colors.borderMuted }}>
          <h2 className="font-semibold text-lg flex items-center gap-2" style={{ color: colors.textPrimary }}>
            <Users className="w-5 h-5 text-[#088395]" />
            Participants
          </h2>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)} style={{ color: colors.textSecondary }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {participantsList.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: colors.textTertiary }}>Connecting...</p>
          ) : (
            participantsList.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${user.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ borderColor: isDark ? colors.backgroundSolid : colors.surface }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate" style={{ color: colors.textPrimary }}>
                    {user.name} {user.id === currentProfile.id && "(You)"}
                  </p>
                  <p className="text-xs text-opacity-70 truncate" style={{ color: colors.textSecondary }}>@{user.username}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-opacity-20" style={{ borderColor: colors.borderMuted }}>
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md"
            style={{
              background: colors.surfaceHover,
              color: copiedLink ? '#10b981' : colors.textPrimary,
              border: `1px solid ${colors.border}`
            }}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copiedLink ? "Link Copied!" : "Copy Link"}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 ">
        <header className="shrink-0 backdrop-blur-md px-4 py-3 flex items-center justify-between" style={{ background: isDark ? "rgba(3,7,18,0.8)" : "rgba(239,233,227,0.8)", borderBottom: `1px solid ${colors.borderMuted}` }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 rounded-lg transition-colors cursor-pointer"
              style={{ background: colors.surface }}
            >
              <ArrowRightCircle className="w-5 h-5 rotate-180" style={{ color: colors.textSecondary }} />
            </button>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm sm:text-base truncate" style={{ color: colors.textPrimary }}>Quick Chat</h1>
              <p className="text-xs" style={{ color: colors.textSecondary }}>{participantsList.length} participant{participantsList.length !== 1 && 's'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.some(m => m.sender_id === currentProfile.id) && (
              <button 
                onClick={() => setShowClearModal(true)}
                className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all"
                title="Clear My Messages"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {isCreator && (
              <button 
                onClick={() => setShowDestroyModal(true)}
                className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all flex items-center gap-1"
                title="Destroy Chat"
              >
                <ShieldAlert className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-semibold">Destroy Room</span>
              </button>
            )}
            <button
              className="md:hidden p-2 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: colors.surface, color: colors.textSecondary }}
            >
              <Users className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 w-full overflow-hidden" style={{ background: isDark ? "#111827" : colors.surface }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-62.5 text-center px-4">
              <div className="w-16 h-16 bg-linear-to-br from-[#09637E]/20 to-[#088395]/20 rounded-3xl flex items-center justify-center mb-4">
                <Link2 className="w-8 h-8 text-[#09637E]" />
              </div>
              <p className="text-sm pb-1 font-semibold" style={{ color: colors.textPrimary }}>One-Time Chat Room</p>
              <p className="text-xs max-w-sm" style={{ color: colors.textSecondary }}>Messages sent here are broadcast over a temporary channel and are not saved permanently.</p>
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
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col max-w-full">
                    <div className={`flex ${isOwn ? "justify-end" : "justify-start items-end gap-2"} max-w-full`}>
                      {!isOwn && (
                        <div className="shrink-0 mb-0.5">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-sm">
                            {msg.sender_name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      )}
                      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-full`}>
                        {/* Name and Username label if not own */}
                        {!isOwn && (
                          <div className="flex items-baseline gap-1 mb-1 ml-1">
                            <span className="text-[10px] sm:text-xs font-medium" style={{ color: colors.textSecondary }}>
                              {msg.sender_name}
                            </span>
                            <span className="text-[8px] sm:text-[10px]" style={{ color: colors.textTertiary }}>
                              @{msg.sender_username}
                            </span>
                          </div>
                        )}
                        <div
                          className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl ${isOwn
                            ? "bg-linear-to-r from-[#09637E] to-[#088395] text-white rounded-br-md shadow-sm"
                            : "rounded-bl-md shadow-xs"
                            }`}
                          style={!isOwn ? { background: colors.surfaceHover, color: colors.textPrimary } : {}}
                        >
                          <p className="text-xs sm:text-sm whitespace-pre-wrap wrap-break-word leading-relaxed">{msg.content}</p>
                          <p className={`text-[9px] sm:text-[10px] mt-1 text-right sm:text-left ${isOwn ? "text-white/60" : ""}`} style={!isOwn ? { color: colors.textSecondary } : {}}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <footer className="safe-bottom-area relative z-10 shrink-0 backdrop-blur-md" style={{ background: isDark ? "rgba(3,7,18,0.8)" : "rgba(239,233,227,0.8)", borderTop: `1px solid ${colors.borderMuted}`, padding: '13px' }}>
          <div className="flex items-center gap-2 sm:gap-3 max-w-5xl mx-auto">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              enterKeyHint="send"
              className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all text-xs sm:text-sm`}
              style={{ background: colors.inputBg, border: `1px solid ${colors.border}`, color: colors.textPrimary }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="p-2.5 sm:p-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white rounded-xl transition-all shadow-lg shadow-[#09637E]/25 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowRightCircle />
            </button>
          </div>
        </footer>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <ConfirmationModal
        isOpen={showDestroyModal}
        onClose={() => setShowDestroyModal(false)}
        onConfirm={handleDestroy}
        title="Destroy Quick Chat"
        message="Are you sure you want to permanently destroy this room? All participants will be removed and it will be deleted immediately."
        confirmText="Destroy Room"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearMessages}
        title="Clear My Messages"
        message="This will instantly delete all of your messages from this chat room for all participants."
        confirmText="Clear Messages"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
