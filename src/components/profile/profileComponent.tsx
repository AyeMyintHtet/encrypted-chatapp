"use client";

import { useState, memo } from "react";
import { THEME_CONFIG, type ThemeType, type ThemeColors } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCurrentProfile } from "@/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  User as UserIcon,
  AtSign,
  LogOut,
  Check,
  X,
  Moon,
  Sun,
  Loader2,
} from "lucide-react";

/**
 * Reusable, memoized component for inline editing of profile fields.
 * Follows Vercel's rerender-memo best practice to prevent unnecessary re-renders.
 */
const EditableSettingItem = memo(function EditableSettingItem({
  icon: Icon,
  label,
  value,
  field,
  colors,
  onSave,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  field: string;
  colors: Record<string, string>;
  onSave: (field: string, newValue: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    const trimmed = currentValue.trim();
    if (trimmed === value || !trimmed) {
      setIsEditing(false);
      setCurrentValue(value);
      setErrorMsg("");
      return;
    }

    setSaveStatus("loading");
    setErrorMsg("");

    const result = await onSave(field, trimmed);
    if (result.success) {
      setSaveStatus("success");
      setTimeout(() => {
        setIsEditing(false);
        setSaveStatus("idle");
      }, 600);
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error || "An error occurred");
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }
  };

  return (
    <div
      className="flex flex-col p-3 md:p-4 transition-colors relative"
      style={{ borderBottom: `1px solid ${colors.borderMuted}` }}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div
          className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: colors.surfaceHover, color: colors.accent }}
        >
          <Icon className="w-4.5 h-4.5 md:w-5 md:h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider mb-0.5"
            style={{ color: colors.textTertiary }}
          >
            {label}
          </p>

          {isEditing ? (
            <input
              type="text"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              disabled={saveStatus === "loading" || saveStatus === "success"}
              autoFocus
              className="w-full bg-transparent border-none outline-none text-[15px] md:text-[17px] font-semibold placeholder-gray-400 py-1"
              style={{ color: colors.textPrimary }}
              placeholder={`Enter your ${label.toLowerCase()}`}

            />
          ) : (
            <p className="text-[15px] md:text-[17px] font-semibold truncate" style={{ color: colors.textPrimary }}>
              {value}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setCurrentValue(value);
                  setErrorMsg("");
                  setSaveStatus("idle");
                }}
                disabled={saveStatus === "loading" || saveStatus === "success"}
                className="p-1.5 rounded-full transition-colors cursor-pointer"
                style={{ color: colors.accentSecondary, background: colors.surfaceHover }}
              >
                <X className="w-4 h-4 md:w-4.5 md:h-4.5" />
              </button>
              <button
                onClick={handleSave}
                disabled={saveStatus === "loading" || saveStatus === "success"}
                className="p-1.5 rounded-full transition-colors cursor-pointer"
                style={{
                  color: saveStatus === "error" ? '#EF4444' : saveStatus === "success" ? '#10B981' : colors.accentSecondary,
                  background: saveStatus === "error" ? 'rgba(239, 68, 68, 0.1)' : saveStatus === "success" ? 'rgba(16, 185, 129, 0.1)' : colors.surfaceHover
                }}
              >
                {saveStatus === "loading" ? (
                  <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin" />
                ) : saveStatus === "error" ? (
                  <X className="w-4 h-4 md:w-4.5 md:h-4.5" />
                ) : (
                  <Check className="w-4 h-4 md:w-4.5 md:h-4.5" />
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs md:text-sm font-bold transition-opacity cursor-pointer px-2 py-1 md:px-3 md:py-1.5 rounded-lg"
              style={{ color: colors.accent, background: `${colors.accent}15` }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {field === "username" && isEditing && (
        <p className="text-[11px] md:text-xs mt-3 ml-12 md:ml-14 leading-relaxed" style={{ color: colors.textTertiary }}>
          You can choose a username on CQgram. Other people will be able to find you by this username and contact you without knowing your email.
        </p>
      )}

      {errorMsg && (
        <p className="text-[11px] md:text-xs mt-2 ml-12 md:ml-14 font-medium text-[#EF4444]">
          {errorMsg}
        </p>
      )}
    </div>
  );
});

export default function ProfileComponent({
  setShowSignOutConfirm,
}: {
  setShowSignOutConfirm: (value: boolean) => void;
}) {
  const { data: profile, isLoading } = useCurrentProfile();
  const { theme, toggleTheme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const queryClient = useQueryClient();

  const handleUpdate = async (field: string, newValue: string): Promise<{ success: boolean; error?: string }> => {
    if (!profile) return { success: false, error: "Profile not found" };

    // Validate username input to avoid failing silently
    if (field === "username" && !/^[a-zA-Z0-9_]+$/.test(newValue)) {
      return { success: false, error: "Username can only contain letters, numbers, and underscores." };
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ [field]: newValue }).eq("id", profile.id);

      if (error) {
        if (error.code === "23505") {
          return { success: false, error: "Username is already taken." };
        }
        return { success: false, error: error.message };
      }

      // Optimistic cache update (rerender-functional-setstate)
      queryClient.setQueryData(["currentProfile"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          [field]: newValue,
        };
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center" style={{ color: colors.textSecondary }}>
        Loading profile...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col items-center pt-4 md:pt-8 pb-2 md:pb-4">
        <div className="relative group cursor-pointer mb-3 md:mb-5">
          <div className="w-20 h-20 md:w-28 md:h-28 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-105">
            <span className="text-white text-3xl md:text-5xl font-bold">
              {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          {/* Camera overlay indicator */}
          <div
            className="absolute bottom-0 right-0 w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110"
            style={{ background: colors.background, border: `2px solid ${colors.backgroundSolid}`, color: colors.accent }}
          >
            <Camera className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" strokeWidth={2.5} />
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-0.5 md:mb-1" style={{ color: colors.textPrimary }}>
          {profile.name}
        </h2>
        <p className="text-sm md:text-base font-medium" style={{ color: colors.textTertiary }}>
          @{profile.username}
        </p>
      </div>

      {/* Account Settings List */}
      <div
        className="rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex flex-col"
        style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <div
          className="px-4 py-2 md:py-2.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider"
          style={{ background: colors.surfaceHover, color: colors.textSecondary }}
        >
          Account Settings
        </div>

        <EditableSettingItem
          icon={UserIcon}
          label="Display Name"
          value={profile.name}
          field="name"
          colors={colors}
          onSave={handleUpdate}
        />
        <EditableSettingItem
          icon={AtSign}
          label="Username"
          value={profile.username}
          field="username"
          colors={colors}
          onSave={handleUpdate}
        />
      </div>

      {/* App Settings List */}
      <div
        className="rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex flex-col"
        style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <div
          className="px-4 py-2 md:py-2.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider"
          style={{ background: colors.surfaceHover, color: colors.textSecondary }}
        >
          App Settings
        </div>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 transition-colors cursor-pointer text-left group"
          style={{ borderBottom: `1px solid ${colors.borderMuted}` }}
        >
          <div
            className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm"
            style={{ background: colors.surfaceHover, color: colors.accent }}
          >
            {theme === "dark" ? <Moon className="w-4 h-4 md:w-5 md:h-5" /> : <Sun className="w-4 h-4 md:w-5 md:h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] md:text-[17px] font-semibold" style={{ color: colors.textPrimary }}>
              Dark Mode
            </p>
            <p className="text-[12px] md:text-[13px] truncate mt-0.5 transition-colors" style={{ color: colors.textTertiary }}>
              {theme === "dark" ? "On" : "Off"}
            </p>
          </div>

          <div className="shrink-0 flex items-center">
            <div
              className="w-[42px] h-6 md:w-12 md:h-7 rounded-full transition-all duration-300 ease-in-out flex items-center px-0.5 md:px-[3px] shadow-inner"
              style={{
                background: theme === 'dark' ? colors.accent : colors.surfaceHover,
                border: theme === 'dark' ? `1px solid ${colors.accentSecondary}` : `1px solid ${colors.borderMuted}`
              }}
            >
              <div
                className={`w-[18px] h-[18px] md:w-5 md:h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out flex items-center justify-center
                  ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Sign Out Button */}
      <div
        className="rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex flex-col mt-1 md:mt-2 mb-6"
        style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 p-3 md:p-4 text-[15px] md:text-[16px] font-bold transition-all cursor-pointer hover:bg-red-500/10"
          style={{ color: "#EF4444", background: "rgba(239, 68, 68, 0.05)" }}
        >
          <LogOut className="w-4.5 h-4.5 md:w-5 md:h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}