"use client"
import ProfileComponent from "@/components/profile/profileComponent";
import SignOutModal from "@/components/SignOut";
import { useState } from "react";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import Header from "@/components/Header";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  return (
    <section
      style={{ background: colors.background }}
    >
      <Header />
      <div
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8 min-h-screen"
      >
        <ChevronLeft color={colors.textPrimary} className="w-6 h-6 cursor-pointer" onClick={() => router.back()} />
        <ProfileComponent setShowSignOutConfirm={setShowSignOutConfirm} />
        <SignOutModal showSignOutConfirm={showSignOutConfirm} setShowSignOutConfirm={setShowSignOutConfirm} />
      </div>
    </section>

  )
}