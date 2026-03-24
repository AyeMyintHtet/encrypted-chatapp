import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ThemeToggle from "./ThemeToggle";
import { useRouter } from "next/navigation";

export default function Header({ profile, setShowSignOutConfirm }: { profile?: any, setShowSignOutConfirm?: (value: boolean) => void }) {
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const router = useRouter();
  return (
    <header 
      className="sticky top-0 w-full z-50 backdrop-blur-xl transition-colors duration-300" 
      style={{ 
        background: theme === 'dark' ? 'rgba(3, 7, 18, 0.8)' : 'rgba(249, 248, 246, 0.8)',
        borderBottom: `1px solid ${colors.borderMuted}` 
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="cursor-pointer flex items-center"
          onClick={() => router.push('/dashboard')}
        >
          <Image
            src="/logoo.png"
            width={100}
            height={100}
            alt="Logo"
            className="-ml-5"
            priority
            fetchPriority="high"
          />
          <div className="-ml-5">
            <h1 className="font-bold text-lg" style={{ color: colors.textPrimary }}>CQgram</h1>
            <p style={{ color: colors.textTertiary }} className="text-xs hidden sm:block">Encrypted P2P Messaging</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* User info with status */}
          {
            profile && (
              <div className="cursor-pointer hidden md:flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
                onClick={() => router.push('/profile')}
              >
                <div className="relative">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 bg-linear-to-br from-[#09637E] to-[#088395] rounded-full flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="">
                  <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>{profile.name}</p>
                </div>
              </div>
            )
          }
          <ThemeToggle />
          {
            setShowSignOutConfirm && (
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  color: colors.textSecondary,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
                aria-label="Sign out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
        </div>
      </div>
    </header>
  )
}