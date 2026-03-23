

import { THEME_CONFIG, ThemeType } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useCurrentProfile } from "@/hooks/useProfile";


export default function ProfileComponent({ setShowSignOutConfirm }: { setShowSignOutConfirm: (value: boolean) => void }) {
  const { data: profile, isLoading: loading } = useCurrentProfile();

  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  return (
    <div
      className="rounded-2xl p-6 shadow-xl flex flex-col items-center gap-4 relative z-10"
      style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <div className="w-20 h-20 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center shadow-lg">
        <span className="text-white text-3xl font-bold">{profile?.name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{profile?.name}</h2>
        <p style={{ color: colors.textTertiary }}>@{profile?.username}</p>
      </div>
      <button
        onClick={() => setShowSignOutConfirm(true)}
        className="cursor-pointer mt-4 px-6 py-2 rounded-full font-medium transition-colors border w-full text-center"
        style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
      >
        Sign Out
      </button>
    </div>
  )
}