"use client";

import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

interface TypingIndicatorProps {
  /** The display name of the peer who is typing */
  peerName: string;
}

/**
 * Animated "User is typing…" bubble shown above the message composer.
 * Renders 3 bouncing dots with staggered animation to convey activity.
 * Keyframes are defined in globals.css (`typingBounce`).
 */
export default function TypingIndicator({ peerName }: TypingIndicatorProps) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const isDark = theme === "dark";

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-1">
      <div className="flex items-center gap-2">
        {/* Bouncing dots bubble */}
        <div
          className="inline-flex items-center gap-0.75 px-3 py-2 rounded-2xl rounded-bl-md"
          style={{
            background: isDark ? colors.surfaceHover : colors.surface,
            border: `1px solid ${colors.borderMuted}`,
          }}
        >
          {/* Three dots with staggered CSS animation delays */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: "#09637E",
                animation: `typingBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Label text */}
        <span
          className="text-[10px] sm:text-xs italic"
          style={{ color: colors.textTertiary }}
        >
          {peerName} is typing…
        </span>
      </div>
    </div>
  );
}
