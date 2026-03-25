"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Full-screen image viewer overlay.
 * Rendered via portal to document.body so it escapes any parent overflow/stacking context.
 * Reused by UserAvatar (click-to-view) and AvatarUploadModal (preview current photo).
 * Closes on backdrop click or Escape key.
 */
export default function FullSizeImageViewer({
  src,
  alt,
  isOpen,
  onClose,
}: {
  /** Image URL to display */
  src: string;
  /** Accessible alt text */
  alt: string;
  /** Controls visibility */
  isOpen: boolean;
  /** Called when the viewer should close */
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portal to document.body — ensures the overlay is never clipped by
  // parent elements with overflow:hidden or their own stacking contexts
  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        aria-label="Close full size view"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Large image */}
      <img
        src={src}
        alt={alt}
        className="relative z-10 max-w-[85vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
