"use client";

import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedImageBlob, createImagePreviewUrl } from "@/lib/avatar/cropImage";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { X, Upload, Loader2, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import FullSizeImageViewer from "@/components/FullSizeImageViewer";

/**
 * Full-screen modal for uploading and cropping a profile picture.
 * Uses `react-easy-crop` for pan/zoom/positioning within a circular mask.
 *
 * Workflow:
 * 1. User selects image file → preview loads in cropper
 * 2. User adjusts crop area (zoom, pan)
 * 3. On confirm → crops to 512×512, converts to WebP, uploads to Supabase Storage
 * 4. Updates `profiles.avatar_url` with the public URL
 */
export default function AvatarUploadModal({
  isOpen,
  onClose,
  userId,
  currentAvatarUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Auth UID — used for storage path and profile update */
  userId: string;
  /** Existing avatar URL (for display reference) */
  currentAvatarUrl: string | null | undefined;
}) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const queryClient = useQueryClient();

  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Full-size viewer state — lets users preview their current avatar at full resolution
  const [isViewingFullSize, setIsViewingFullSize] = useState(false);

  // File input ref for programmatic trigger
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Handle file selection — validate and create preview URL */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 10MB for the raw input — we compress it later)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }

    setError(null);
    const previewUrl = createImagePreviewUrl(file);
    setImageSrc(previewUrl);
    // Reset crop state for new image
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  /** Called by react-easy-crop when user finishes adjusting the crop area */
  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  /** Crop, compress, upload to Supabase, and update profile */
  const handleUpload = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels || !userId) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Crop and convert to optimized WebP blob
      const croppedBlob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);

      // 2. Upload to Supabase Storage — path: avatars/{userId}/avatar.webp
      //    Using a fixed filename ensures old avatar is overwritten automatically
      const supabase = createClient();
      const filePath = `${userId}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: true, // Overwrite existing avatar
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // 3. Get the public URL for the uploaded avatar
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Append cache-busting timestamp so browser fetches the new image
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // 4. Update the profile row with the new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 5. Optimistic cache update — immediately reflect the change everywhere
      queryClient.setQueryData(
        ["currentProfile"],
        (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          return { ...old, avatar_url: publicUrl };
        }
      );
      // Also invalidate any peer profile queries that might cache this user's avatar
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // 6. Clean up preview URL and close modal
      URL.revokeObjectURL(imageSrc);
      setImageSrc(null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [imageSrc, croppedAreaPixels, userId, queryClient, onClose]);

  /** Reset state and close */
  const handleClose = useCallback(() => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
    onClose();
  }, [imageSrc, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal container */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${colors.borderMuted}` }}
        >
          <h3
            className="text-lg font-bold"
            style={{ color: colors.textPrimary }}
          >
            {imageSrc ? "Adjust Photo" : "Upload Photo"}
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{ color: colors.textSecondary, background: colors.surfaceHover }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex flex-col items-center px-5 py-6">
          {!imageSrc ? (
            /* File selection state */
            <div className="w-full flex flex-col items-center gap-4">
              {/* Preview of current avatar or placeholder */}
              <div className="relative group">
                <div
                  className={`w-32 h-32 rounded-full overflow-hidden flex items-center justify-center ${currentAvatarUrl ? "cursor-pointer" : ""}`}
                  style={{ background: colors.surfaceHover, border: `2px dashed ${colors.borderMuted}` }}
                  onClick={() => { if (currentAvatarUrl) setIsViewingFullSize(true); }}
                  role={currentAvatarUrl ? "button" : undefined}
                  tabIndex={currentAvatarUrl ? 0 : undefined}
                  onKeyDown={(e) => { if (currentAvatarUrl && e.key === "Enter") setIsViewingFullSize(true); }}
                  aria-label={currentAvatarUrl ? "View full size photo" : undefined}
                >
                  {currentAvatarUrl ? (
                    <img
                      src={currentAvatarUrl}
                      alt="Current avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Upload className="w-10 h-10" style={{ color: colors.textTertiary }} />
                  )}
                </div>
                {/* Expand icon overlay — only when avatar exists */}
                {currentAvatarUrl && (
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200 cursor-pointer"
                    onClick={() => setIsViewingFullSize(true)}
                  >
                    <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                  </div>
                )}
              </div>

              <p
                className="text-sm text-center max-w-xs"
                style={{ color: colors.textSecondary }}
              >
                Choose a photo from your device. You can adjust the position and zoom before uploading.
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all cursor-pointer bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] shadow-lg shadow-[#09637E]/25"
              >
                Choose Photo
              </button>
            </div>
          ) : (
            /* Cropper state */
            <div className="w-full flex flex-col items-center gap-4">
              {/* Crop area — fixed aspect ratio circle */}
              <div className="relative w-full aspect-square max-w-[320px] rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{
                    containerStyle: {
                      borderRadius: "12px",
                    },
                  }}
                />
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-3 w-full max-w-70">
                <ZoomOut className="w-4 h-4 shrink-0" style={{ color: colors.textTertiary }} />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #09637E ${((zoom - 1) / 2) * 100}%, ${colors.surfaceHover} ${((zoom - 1) / 2) * 100}%)`,
                  }}
                />
                <ZoomIn className="w-4 h-4 shrink-0" style={{ color: colors.textTertiary }} />
              </div>

              {/* Reset zoom button */}
              <button
                onClick={() => {
                  setZoom(1);
                  setCrop({ x: 0, y: 0 });
                }}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-lg"
                style={{ color: colors.textSecondary, background: colors.surfaceHover }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-xs text-[#EF4444] mt-3 text-center font-medium">
              {error}
            </p>
          )}
        </div>

        {/* Footer actions */}
        {imageSrc && (
          <div
            className="flex items-center justify-between px-5 py-4 gap-3"
            style={{ borderTop: `1px solid ${colors.borderMuted}` }}
          >
            <button
              onClick={() => {
                URL.revokeObjectURL(imageSrc);
                setImageSrc(null);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setError(null);
              }}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              style={{ color: colors.textSecondary, background: colors.surfaceHover }}
            >
              Change Photo
            </button>

            <button
              onClick={handleUpload}
              disabled={isUploading || !croppedAreaPixels}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white transition-all cursor-pointer bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] shadow-lg shadow-[#09637E]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Full-size avatar viewer — uses shared component (DRY) */}
      <FullSizeImageViewer
        src={currentAvatarUrl ?? ""}
        alt="Current profile photo"
        isOpen={isViewingFullSize}
        onClose={() => setIsViewingFullSize(false)}
      />
    </div>
  );
}
