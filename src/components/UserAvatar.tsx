"use client";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import FullSizeImageViewer from "@/components/FullSizeImageViewer";

/**
 * Reusable avatar component that displays either the user's uploaded profile picture
 * or a gradient fallback with their initial. Used across the entire app to ensure
 * consistent avatar rendering (profile page, header, contacts, chat, etc.).
 *
 * When an avatar image exists, clicking it opens a full-size viewer overlay.
 */
const UserAvatar = memo(function UserAvatar({
  name,
  avatarUrl,
  size = 40,
  className = "",
  textClassName = "",
  disableViewer = false,
}: {
  /** Display name — first character is used for the fallback initial */
  name: string;
  /** Public URL of the uploaded avatar image (null = show initial) */
  avatarUrl: string | null | undefined;
  /** Diameter in pixels (used for width/height) */
  size?: number;
  /** Additional CSS class names for the outer container */
  className?: string;
  /** Additional CSS class names for the fallback text */
  textClassName?: string;
  /** When true, clicking the avatar won't open the full-size viewer (e.g. Header where parent handles navigation) */
  disableViewer?: boolean;
}) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Whether the avatar should be interactive (clickable to view full-size)
  const isClickable = !!avatarUrl && !disableViewer;

  /** Open full-size viewer — only when avatar exists and viewer is enabled */
  const handleAvatarClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isClickable) return;
      e.stopPropagation();
      setIsViewerOpen(true);
    },
    [isClickable]
  );

  return (
    <>
      <div
        className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 ${isClickable ? "cursor-pointer" : ""} ${className}`}
        style={{ width: size, height: size }}
        onClick={handleAvatarClick}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (isClickable && e.key === "Enter") {
            e.stopPropagation();
            setIsViewerOpen(true);
          }
        }}
        aria-label={isClickable ? `View ${name}'s photo` : undefined}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`${name}'s avatar`}
            width={size}
            height={size}
            className="w-full h-full object-cover"
            sizes={`${size}px`}
            // Use Supabase CDN, avoid Next.js image optimization overhead for external URLs
            unoptimized
          />
        ) : (
          // Gradient fallback matching the app's teal brand colors
          <div className="w-full h-full bg-linear-to-br from-[#09637E] to-[#088395] flex items-center justify-center">
            <span className={`text-white font-bold select-none ${textClassName}`}>
              {initial}
            </span>
          </div>
        )}
      </div>

      {/* Full-size viewer — only rendered when viewer is enabled */}
      {!disableViewer && (
        <FullSizeImageViewer
          src={avatarUrl ?? ""}
          alt={`${name}'s profile photo`}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
});

export default UserAvatar;
