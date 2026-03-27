"use client";

import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";

/**
 * Skeleton row descriptors — hoisted outside the component (Vercel: rendering-hoist-jsx)
 * so the array is not re-created on every render.
 *
 * Each row describes whether it is an outgoing message and the widths
 * of its placeholder bubble(s).
 */
const SKELETON_ROWS: Array<{ own: boolean; widths: string[] }> = [
  { own: false, widths: ["w-48", "w-32"] },
  { own: true,  widths: ["w-40"] },
  { own: false, widths: ["w-56", "w-24"] },
  { own: true,  widths: ["w-36", "w-28"] },
  { own: false, widths: ["w-44"] },
  { own: true,  widths: ["w-52", "w-16"] },
];

/**
 * ChatPageSkeleton
 *
 * Renders an animated shimmer placeholder that mirrors the real chat page layout
 * (header → message list → input bar). Shown while profile data is loading so the
 * user never stares at a blank screen. Fully theme-aware and accessible.
 */
export default function ChatPageSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = THEME_CONFIG[theme as ThemeType];

  // Shimmer gradient tokens differ between themes for readability
  const shimmerBase  = isDark ? "#1f2937" : "#e5ddd5";
  const shimmerMid   = isDark ? "#374151" : "#d4c9be";
  const headerBg     = isDark ? "rgba(3,7,18,0.8)"     : "rgba(239,233,227,0.8)";
  const messageBg    = isDark ? "#111827"               : colors.surface;

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      style={{ background: colors.backgroundSolid }}
      role="status"
      aria-label="Loading chat…"
      aria-busy="true"
    >
      {/*
       * Inject shimmer keyframe once per mount via a scoped <style> tag.
       * Using CSS variables so both themes share a single rule.
       */}
      <style>{`
        @keyframes antigravity-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .skeleton-bone {
          background: linear-gradient(
            90deg,
            ${shimmerBase} 25%,
            ${shimmerMid}  50%,
            ${shimmerBase} 75%
          );
          background-size: 400px 100%;
          animation: antigravity-shimmer 1.4s infinite linear;
          border-radius: 8px;
        }
      `}</style>

      {/* ── Header skeleton ──────────────────────────────────────── */}
      <header
        className="shrink-0 px-4 py-3 flex items-center justify-between"
        style={{
          background: headerBg,
          borderBottom: `1px solid ${colors.borderMuted}`,
        }}
      >
        {/* Left side: back button + avatar + name/status */}
        <div className="flex items-center gap-3">
          {/* Back chevron button placeholder */}
          <div className="skeleton-bone w-9 h-9 rounded-lg" />

          {/* Avatar circle */}
          <div className="skeleton-bone w-9 h-9 rounded-full" />

          {/* Name row + status row */}
          <div className="flex flex-col gap-2">
            <div className="skeleton-bone h-3 w-28 rounded" />
            <div className="skeleton-bone h-2.5 w-20 rounded" />
          </div>
        </div>

        {/* Right side: theme toggle + actions */}
        <div className="flex items-center gap-2">
          <div className="skeleton-bone w-8 h-8 rounded-lg" />
        </div>
      </header>

      {/* ── Message list skeleton ─────────────────────────────────── */}
      <main
        className="flex-1 min-h-0 px-4 py-4 flex flex-col gap-3 overflow-hidden"
        style={{ background: messageBg }}
      >
        {SKELETON_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex flex-col gap-1.5 ${row.own ? "items-end" : "items-start"}`}
          >
            {row.widths.map((width, bubbleIndex) => (
              <div
                key={bubbleIndex}
                className={`skeleton-bone h-9 ${width} ${
                  row.own ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
                }`}
              />
            ))}
          </div>
        ))}
      </main>

      {/* ── Input bar skeleton ────────────────────────────────────── */}
      <footer
        className="shrink-0 px-4 py-3"
        style={{
          background: headerBg,
          borderTop: `1px solid ${colors.borderMuted}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="skeleton-bone flex-1 h-11 rounded-xl" />
        </div>
      </footer>

      {/* Screen-reader-only live text so assistive technology announces the state */}
      <span className="sr-only">Loading chat, please wait…</span>
    </div>
  );
}
