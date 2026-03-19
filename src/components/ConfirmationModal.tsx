import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "info";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger",
}: ConfirmationModalProps) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-sm mx-auto my-auto overflow-hidden rounded-3xl shadow-2xl border animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 ease-out"
        style={{
          background: colors.surface,
          borderColor: colors.border
        }}
      >
        <div className="p-6">
          <h3 className="text-lg font-bold mb-2" style={{ color: colors.textPrimary }}>
            {title}
          </h3>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: colors.textSecondary }}>
            {message}
          </p>

          {/* <input type="checkbox" id="clear-chat" className="mr-2 mb-5" />
          <label htmlFor="clear-chat" className="text-sm leading-relaxed" style={{ color: colors.textPrimary }}>Also Delete in Peer's Chat</label> */}

          <div className="flex flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: colors.surfaceHover,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg transition-all cursor-pointer ${type === "danger"
                ? "bg-linear-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/20"
                : "bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] shadow-[#09637E]/20"
                }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
