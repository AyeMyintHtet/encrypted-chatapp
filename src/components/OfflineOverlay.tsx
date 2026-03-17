"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Global overlay that activates when the browser goes offline.
 * - Dims the entire page to opacity 0.7
 * - Shows a centered popup warning the user about connectivity
 * - Automatically dismisses when the connection is restored
 */
export default function OfflineOverlay() {
  const isOnline = useOnlineStatus();

  // Don't render anything when online
  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      {/* Semi-transparent backdrop that dims the page */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Popup card */}
      <div
        className="relative flex flex-col items-center gap-4 px-8 py-6 rounded-2xl shadow-2xl border border-red-500/20 max-w-sm mx-4 animate-[fadeInUp_0.3s_ease-out]"
        style={{ background: "rgba(30, 30, 30, 0.95)" }}
      >
        {/* Wifi-off icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10">
          <svg
            className="w-7 h-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {/* Slash line across wifi symbol */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.72 11.06A10.94 10.94 0 0112 10c-1.5 0-2.94.3-4.24.84M5 12.55a10.94 10.94 0 00-.53.45M8.53 16.11a6 6 0 016.95 0M12 20h.01"
            />
          </svg>
        </div>

        {/* Warning text */}
        <p className="text-white text-center font-semibold text-base leading-relaxed">
          Internet connection closed or unstable
        </p>

        {/* Subtle helper text */}
        <p className="text-gray-400 text-center text-xs">
          Please check your network. This will disappear automatically when reconnected.
        </p>

        {/* Pulsing indicator */}
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-medium">Offline</span>
        </div>
      </div>
    </div>
  );
}
