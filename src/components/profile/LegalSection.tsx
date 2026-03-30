"use client";

import { useState } from "react";
import { ShieldCheck, FileText, ChevronRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { PRIVACY_POLICY, TERMS_CONDITIONS } from "@/constants/legal";
import { LegalModal } from "./LegalModal";

export default function LegalSection() {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const [activeModal, setActiveModal] = useState<"privacy" | "terms" | null>(null);

  const ModalOptions = [
    { id: "privacy", icon: ShieldCheck, title: "Privacy Policy", content: PRIVACY_POLICY },
    { id: "terms", icon: FileText, title: "Terms & Conditions", content: TERMS_CONDITIONS },
  ] as const;

  return (
    <>
      <div 
        className="rounded-xl md:rounded-2xl overflow-hidden shadow-sm flex flex-col mt-4 md:mt-6"
        style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
      >
        <div 
          className="px-4 py-2 md:py-2.5 text-[11px] md:text-[12px] font-bold uppercase tracking-wider"
          style={{ background: colors.surfaceHover, color: colors.textSecondary }}
        >
          Legal Information
        </div>
        
        <div className="flex flex-col">
          {ModalOptions.map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => setActiveModal(opt.id)}
              className="flex items-center gap-3 p-3 md:p-4 text-left transition-colors cursor-pointer"
              style={{
                borderTop: i > 0 ? `1px solid ${colors.borderMuted}` : 'none',
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${colors.accent}12`, color: colors.accent }}
              >
                <opt.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] md:text-[15px] font-semibold" style={{ color: colors.textPrimary }}>
                  {opt.title}
                </p>
                <p className="text-[11px] md:text-[12px] truncate mt-0.5" style={{ color: colors.textTertiary }}>
                  Read our {opt.title.toLowerCase()}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 shrink-0" style={{ color: colors.textTertiary }} />
            </button>
          ))}
        </div>
      </div>

      <LegalModal activeModal={activeModal} setActiveModal={setActiveModal} />
    </>
  );
}

