"use client";

import { useState, useEffect } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ConfirmationModal from "@/components/ConfirmationModal";
import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function OneTimeChat() {
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  const [showModal, setShowModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const [isGenerating, setIsGenerating] = useState(false);
  const [manuallyHidden, setManuallyHidden] = useState(false);

  const { data: existingChatId, isLoading: isQueryLoading } = useQuery({
    queryKey: ['active-quick-chat', profile?.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('quick_chats')
        .select('id')
        .eq('creator_id', profile!.id)
        .eq('is_destroyed', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!profile,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (existingChatId && !manuallyHidden) {
      setGeneratedLink(`${window.location.origin}/quick-chat/otc-${existingChatId}`);
    }
  }, [existingChatId, manuallyHidden]);

  const isLoading = profileLoading || isQueryLoading;

  const handleGenerate = async () => {
    if (!profile) return;
    setIsGenerating(true);
    
    // Generate a unique link for one-time chat
    const uniqueId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    const supabase = createClient();
    
    // Destroy any existing active one-time chats for this user first
    await supabase.from('quick_chats')
      .update({ is_destroyed: true })
      .eq('creator_id', profile.id)
      .eq('is_destroyed', false);

    const { error } = await supabase.from('quick_chats').insert({
      id: uniqueId,
      creator_id: profile.id,
      expires_at: expiresAt.toISOString(),
      is_destroyed: false
    });

    setIsGenerating(false);
    
    if (error) {
      console.error("Failed to generate chat", error);
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ['active-quick-chat', profile?.id] });
    const link = `${window.location.origin}/quick-chat/otc-${uniqueId}`;
    setGeneratedLink(link);
    setCopied(false);
  };

  const handleDestroyAndReset = async () => {
    const currentId = generatedLink?.split('otc-')[1] || existingChatId;
    if (currentId) {
      const supabase = createClient();
      await supabase.from('quick_chats').update({ is_destroyed: true }).eq('id', currentId);
    }
    setGeneratedLink(null);
    setManuallyHidden(true);
    queryClient.invalidateQueries({ queryKey: ['active-quick-chat', profile?.id] });
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  return (
    <div className="backdrop-blur-sm rounded-2xl p-6" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.textPrimary }}>
        <Link2 className="w-5 h-5 text-[#088395]" />
        One-Time Chat
      </h2>

      {!generatedLink ? (
        <div className="flex flex-col items-center py-2">
          <p className="text-sm text-center mb-5" style={{ color: colors.textSecondary }}>
            Create a secure, temporary link for a quick conversation.
          </p>
          {isLoading ? (
            <div className="w-full px-6 py-2.5 h-[44px] animate-pulse rounded-xl bg-gray-500/20" />
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={isGenerating}
              className="w-full px-6 py-2.5 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#09637E]/20 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? "Generating..." : "Generate One-Time Chat"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-1 animate-in fade-in zoom-in duration-300">
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Share this link with your contact:
          </p>
          <div
            className="flex items-center gap-2 p-2 rounded-xl"
            style={{ background: colors.surfaceHover, border: `1px solid ${colors.border}` }}
          >
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="flex-1 bg-transparent text-sm px-2 outline-none w-full truncate cursor-pointer"
              style={{ color: colors.textPrimary }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center min-w-9 min-h-9"
              style={{ background: colors.surface, color: copied ? '#10b981' : colors.textSecondary, border: `1px solid ${colors.border}` }}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleDestroyAndReset}
            className="text-xs self-start mt-2 hover:underline cursor-pointer transition-colors"
            style={{ color: colors.textTertiary }}
          >
            Destroy current link and create a new one
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleGenerate}
        title="Generate One-Time Link"
        message="This will create a temporary, secure link that anyone can use to chat with you once. Are you sure you want to proceed?"
        confirmText="Generate Link"
        cancelText="Cancel"
        type="info"
      />
    </div>
  );
}
