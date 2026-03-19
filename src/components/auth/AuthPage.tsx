"use client";

import Link from "next/link";
import { useActionState, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/context/ThemeContext";
import { THEME_CONFIG, type ThemeType } from "@/constants/theme";
import ThemeToggle from "@/components/ThemeToggle";
import ProjectName from "@/components/ProjectName";

type AuthMode = "login" | "signup";

type AuthPageProps = {
  mode: AuthMode;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MALICIOUS_PATTERN = /(--|;|<|>|'|"|`|\\)/;

const INPUT_CLASS_NAME =
  "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#09637E]/50 focus:border-[#09637E]/50 transition-all placeholder:text-gray-500";
const PRIMARY_BUTTON_CLASS_NAME =
  "w-full py-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#09637E]/25 hover:shadow-[#09637E]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const FLEX_PRIMARY_BUTTON_CLASS_NAME =
  "flex-1 py-3 bg-linear-to-r from-[#09637E] to-[#088395] hover:from-[#0a7490] hover:to-[#099aaa] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#09637E]/25 hover:shadow-[#09637E]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

type AuthActionState = {
  error: string | null;
};

const INITIAL_AUTH_ACTION_STATE: AuthActionState = { error: null };

type SubmitButtonProps = {
  className: string;
  idleText: string;
  pendingText: string;
};

function SubmitButton({ className, idleText, pendingText }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {pendingText}
        </span>
      ) : (
        idleText
      )}
    </button>
  );
}

type PendingInputProps = ComponentProps<"input">;

function PendingInput({ disabled, ...props }: PendingInputProps) {
  const { pending } = useFormStatus();

  return <input {...props} disabled={pending || disabled} />;
}

type PendingButtonProps = ComponentProps<"button">;

function PendingButton({ disabled, ...props }: PendingButtonProps) {
  const { pending } = useFormStatus();

  return <button {...props} disabled={pending || disabled} />;
}

export default function AuthPage({ mode }: AuthPageProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme } = useTheme();
  const colors = THEME_CONFIG[theme as ThemeType];
  const isSignup = mode === "signup";

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [emailStepError, setEmailStepError] = useState<string | null>(null);

  const handleEmailNext = () => {
    const safeEmail = email.trim();
    if (!safeEmail) {
      setEmailStepError("Email is required");
      return;
    }

    if (safeEmail.length > 255) {
      setEmailStepError("Email length exceeds maximum allowed limit.");
      return;
    }

    if (MALICIOUS_PATTERN.test(safeEmail)) {
      setEmailStepError("Invalid characters detected in email. Symbols like <, >, ', \", ; are not allowed.");
      return;
    }

    if (!EMAIL_REGEX.test(safeEmail)) {
      setEmailStepError("Please enter a valid email address");
      return;
    }

    setEmailStepError(null);
    setStep(2);
  };

  const handleLogin = async (_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> => {
    const identifierValue = formData.get("identifier");
    const passwordValue = formData.get("password");

    if (typeof identifierValue !== "string" || typeof passwordValue !== "string") {
      return { error: "Please fill in all fields" };
    }

    const safeIdentifier = identifierValue.trim();
    const safePassword = passwordValue.trim();

    if (!safeIdentifier || !safePassword) {
      return { error: "Please fill in all fields" };
    }

    if (safeIdentifier.length > 255 || safePassword.length > 255) {
      return { error: "Input length exceeds maximum allowed limit." };
    }

    if (MALICIOUS_PATTERN.test(safeIdentifier)) {
      return { error: "Invalid characters detected in the input. Symbols like <, >, ', \", ; are not allowed." };
    }

    try {
      let loginEmail = safeIdentifier;

      if (!EMAIL_REGEX.test(loginEmail)) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginEmail.toLowerCase())
          .maybeSingle();

        if (profileError || !profile) {
          return { error: "No account found with that username" };
        }

        loginEmail = profile.email;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: safePassword,
      });

      if (authError) {
        return { error: authError.message };
      }

      router.push("/dashboard");
      router.refresh();
      return { error: null };
    } catch {
      return { error: "An unexpected error occurred. Please try again." };
    }
  };

  const handleSignup = async (_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> => {
    const nameValue = formData.get("name");
    const usernameValue = formData.get("username");
    const passwordValue = formData.get("password");
    const emailValue = formData.get("email");

    if (
      typeof nameValue !== "string" ||
      typeof usernameValue !== "string" ||
      typeof passwordValue !== "string" ||
      typeof emailValue !== "string"
    ) {
      return { error: "All fields are required" };
    }

    const safeName = nameValue.trim();
    const safeUsername = usernameValue.trim();
    const safePassword = passwordValue.trim();
    const safeEmail = emailValue.trim();

    if (!safeName || !safeUsername || !safePassword || !safeEmail) {
      return { error: "All fields are required" };
    }

    if (safeName.length > 100 || safeUsername.length > 50 || safePassword.length > 255 || safeEmail.length > 255) {
      return { error: "Input length exceeds maximum allowed limit." };
    }

    if (MALICIOUS_PATTERN.test(safeEmail)) {
      return { error: "Invalid characters detected in email. Symbols like <, >, ', \", ; are not allowed." };
    }

    if (!EMAIL_REGEX.test(safeEmail)) {
      return { error: "Please enter a valid email address" };
    }

    if (MALICIOUS_PATTERN.test(safeName)) {
      return { error: "Invalid characters detected in full name. Symbols like <, >, ', \", ; are not allowed." };
    }

    if (safePassword.length < 6) {
      return { error: "Password must be at least 6 characters" };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(safeUsername)) {
      return { error: "Username can only contain letters, numbers, and underscores" };
    }

    try {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", safeUsername.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return { error: "Username is already taken" };
      }

      const { error: authError } = await supabase.auth.signUp({
        email: safeEmail,
        password: safePassword,
        options: {
          data: {
            name: safeName,
            username: safeUsername.toLowerCase(),
          },
        },
      });

      if (authError) {
        return { error: authError.message };
      }

      router.push("/dashboard");
      router.refresh();
      return { error: null };
    } catch {
      return { error: "An unexpected error occurred. Please try again." };
    }
  };

  const [loginState, loginFormAction] = useActionState(handleLogin, INITIAL_AUTH_ACTION_STATE);
  const [signupState, signupFormAction] = useActionState(handleSignup, INITIAL_AUTH_ACTION_STATE);

  const error = isSignup ? (step === 1 ? emailStepError : signupState.error) : loginState.error;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300"
      style={{ background: colors.background }}
      key="shared-auth"
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px]"
          style={{ background: colors.glow1 }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-[100px]"
          style={{ background: colors.glow2 }}
        />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <ProjectName />
        <div
          className="backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 border"
          style={{ background: colors.surface, borderColor: colors.border }}
        >
          {isSignup ? (
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Create Account
              </h1>
              <p
                className="mt-3 text-base sm:text-lg leading-snug"
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  color: colors.textPrimary,
                  opacity: 0.85,
                }}
              >
                &ldquo;Privacy isn&rsquo;t a privilege - it&rsquo;s a right.&rdquo;
              </p>
              <p
                className="mt-2 text-sm tracking-wide font-light"
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  color: colors.textSecondary,
                }}
              >
                {step === 1 ? "Enter your email to get started" : "Complete your profile"}
              </p>
            </div>
          ) : (
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                Welcome Back
              </h1>
            </div>
          )}

          {isSignup && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-1 rounded-full bg-linear-to-r from-[#09637E] to-[#088395]" />
              <div
                className={`flex-1 h-1 rounded-full transition-all duration-500 ${step === 2 ? "bg-linear-to-r from-[#088395] to-[#0a9396]" : ""}`}
                style={step === 1 ? { backgroundColor: colors.border } : {}}
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          {isSignup ? (
            step === 1 ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    maxLength={255}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailStepError) {
                        setEmailStepError(null);
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailNext()}
                    placeholder="you@example.com"
                    className={INPUT_CLASS_NAME}
                    style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                    autoFocus
                  />
                </div>
                <button onClick={handleEmailNext} className={PRIMARY_BUTTON_CLASS_NAME}>
                  Continue
                </button>
              </div>
            ) : (
              <form action={signupFormAction} className="space-y-4">
                <input type="hidden" name="email" value={email} />
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                    Full Name
                  </label>
                  <PendingInput
                    id="name"
                    name="name"
                    type="text"
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className={INPUT_CLASS_NAME}
                    style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                    Username
                  </label>
                  <PendingInput
                    id="username"
                    name="username"
                    type="text"
                    maxLength={50}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className={INPUT_CLASS_NAME}
                    style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                    Password
                  </label>
                  <PendingInput
                    id="password"
                    name="password"
                    type="password"
                    maxLength={255}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={INPUT_CLASS_NAME}
                    style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                  />
                </div>

                <div className="flex gap-3">
                  <PendingButton
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setEmailStepError(null);
                    }}
                    className="px-4 py-3 border text-gray-300 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: colors.surface, borderColor: colors.border, color: colors.textSecondary }}
                  >
                    Back
                  </PendingButton>
                  <SubmitButton className={FLEX_PRIMARY_BUTTON_CLASS_NAME} idleText="Create Account" pendingText="Creating..." />
                </div>
              </form>
            )
          ) : (
            <form action={loginFormAction} className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                  Email or Username
                </label>
                <PendingInput
                  id="identifier"
                  name="identifier"
                  type="text"
                  maxLength={255}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or johndoe"
                  className={INPUT_CLASS_NAME}
                  style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                  Password
                </label>
                <PendingInput
                  id="password"
                  name="password"
                  type="password"
                  maxLength={255}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={INPUT_CLASS_NAME}
                  style={{ background: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
                />
              </div>

              <SubmitButton className={PRIMARY_BUTTON_CLASS_NAME} idleText="Sign In" pendingText="Signing in..." />
            </form>
          )}

          <p className="mt-6 text-center text-sm" style={{ color: colors.textSecondary }}>
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="text-[#088395] hover:text-[#09637E] font-medium transition-colors"
            >
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
