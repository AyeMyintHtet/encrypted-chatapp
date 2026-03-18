"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ThemeToggle from "@/components/ThemeToggle";
import ProjectName from "@/components/ProjectName";

/**
 * Login page supporting both email and username login.
 * If the identifier is not an email, we query the profiles table
 * to resolve the username → email, then sign in with email/password.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = THEME_CONFIG[theme as ThemeType];

  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Determine if the identifier looks like an email */
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const safeIdentifier = identifier.trim();
    const safePassword = password.trim();

    if (!safeIdentifier || !safePassword) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    // Security constraints: Maximum length to prevent payload overflow
    if (safeIdentifier.length > 255 || safePassword.length > 255) {
      setError("Input length exceeds maximum allowed limit.");
      setLoading(false);
      return;
    }

    // Basic SQLi/XSS pattern prevention for identifier
    const maliciousPattern = /(--|;|<|>|'|"|`|\\)/;
    if (maliciousPattern.test(safeIdentifier)) {
      setError("Invalid characters detected in the input. Symbols like <, >, ', \", ; are not allowed.");
      setLoading(false);
      return;
    }

    try {
      let loginEmail = safeIdentifier;

      // If user entered a username (not an email), resolve it to the associated email
      if (!isEmail(loginEmail)) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginEmail.toLowerCase())
          .maybeSingle();

        if (profileError || !profile) {
          setError("No account found with that username");
          setLoading(false);
          return;
        }

        loginEmail = profile.email;
      }

      // Sign in with the resolved email + password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300" style={{ background: colors.background }}>
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow1 }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-[100px]" style={{ background: colors.glow2 }} />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* Product logo */}

      <div className="relative w-full max-w-md">
        {/* Glass card */}
        <ProjectName />
        <div className="backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 border" style={{ background: colors.surface, borderColor: colors.border }}>
          {/* Header with product logo & attractive quote */}
          <div className="text-center mb-8">

            <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>Welcome Back</h1>

          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                Email or Username
              </label>
              <input
                id="identifier"
                type="text"
                maxLength={255}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or johndoe"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all placeholder:text-gray-500"
                style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                maxLength={255}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all placeholder:text-gray-500"
                style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#09637E]/25 hover:shadow-[#09637E]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm" style={{ color: colors.textSecondary }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#088395] hover:text-[#09637E] font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
