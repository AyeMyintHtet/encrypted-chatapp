"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { PRIVACY_POLICY, TERMS_CONDITIONS } from "@/constants/legal";

export function LegalModal({
  activeModal,
  setActiveModal
}: {
  activeModal: "privacy" | "terms" | null;
  setActiveModal: (v: "privacy" | "terms" | null) => void;
}) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];

  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeModal]);

  if (!activeModal) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 sm:py-12 overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity" 
        onClick={() => setActiveModal(null)} 
        aria-hidden="true" 
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col mx-auto my-auto overflow-hidden rounded-2xl shadow-2xl border animate-in fade-in zoom-in slide-in-from-bottom-4 duration-200"
        style={{ background: colors.backgroundSolid, borderColor: colors.border }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 md:px-6 py-4 border-b shrink-0 sticky top-0 z-10"
          style={{ borderColor: colors.borderMuted, background: colors.backgroundSolid }}
        >
          <h2 className="text-lg md:text-xl font-bold" style={{ color: colors.textPrimary }}>
            {activeModal === "privacy" ? "Privacy Policy" : "Terms & Conditions"}
          </h2>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 md:p-2 rounded-full transition-colors cursor-pointer"
            style={{ color: colors.textSecondary }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close modal"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div 
          className="p-5 md:p-6 overflow-y-auto"
          style={{ color: colors.textSecondary, scrollbarWidth: "thin", scrollbarColor: `${colors.border} transparent` }}
        >
          <div 
            className="prose prose-sm md:prose-base max-w-none text-[13px] md:text-[14px] leading-relaxed" 
            dangerouslySetInnerHTML={{ 
              __html: activeModal === "privacy" ? PRIVACY_POLICY : TERMS_CONDITIONS 
            }} 
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
