import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppSettings, Auth, UserProfileSnippet } from "@/store/types";

type ThemeMode = "dark" | "light";

type AuthSessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | string | null;
  user?: {
    id?: string;
    user_metadata?: {
      name?: string;
      username?: string;
      avatar_url?: string | null;
    };
  } | null;
} | null;

interface AuthStoreState {
  auth_token: Auth | null;
  user_profile_snippet: UserProfileSnippet | null;
  theme_mode: ThemeMode;
  app_settings: AppSettings;
  hasHydrated: boolean;
  setAuthToken: (auth: Auth | null) => void;
  setUserProfileSnippet: (profile: UserProfileSnippet | null) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setAppSettings: (settings: Partial<AppSettings>) => void;
  syncAuthFromSession: (session: AuthSessionLike) => void;
  clearStore: () => void;
  setHasHydrated: (value: boolean) => void;
}

const STORE_NAME = "cqgram-auth-store-v1";
const LEGACY_THEME_KEY = "chatapp-theme";

const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
};

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
  return legacyTheme === "light" ? "light" : "dark";
}

function createNoopStorage(): Storage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

const initialState = {
  auth_token: null as Auth | null,
  user_profile_snippet: null as UserProfileSnippet | null,
  theme_mode: getInitialThemeMode() as ThemeMode,
  app_settings: DEFAULT_SETTINGS,
  hasHydrated: false,
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setAuthToken: (auth) => set({ auth_token: auth }),
      setUserProfileSnippet: (profile) => set({ user_profile_snippet: profile }),
      setThemeMode: (theme) => {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LEGACY_THEME_KEY, theme);
        }
        set({ theme_mode: theme });
      },
      setAppSettings: (settings) =>
        set((state) => ({
          app_settings: { ...state.app_settings, ...settings },
        })),
      syncAuthFromSession: (session) => {
        if (!session?.access_token || !session.refresh_token || !session.expires_at) {
          set({ auth_token: null });
          return;
        }

        const expiresAt =
          typeof session.expires_at === "number"
            ? new Date(session.expires_at * 1000).toISOString()
            : session.expires_at;

        set({
          auth_token: {
            token: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt,
          },
          user_profile_snippet: session.user?.id
            ? {
                id: session.user.id,
                name: session.user.user_metadata?.name ?? "",
                username: session.user.user_metadata?.username ?? "",
                avatarUrl: session.user.user_metadata?.avatar_url ?? null,
              }
            : null,
        });
      },
      clearStore: () =>
        set({
          ...initialState,
          theme_mode: getInitialThemeMode(),
          hasHydrated: true,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        auth_token: state.auth_token,
        user_profile_snippet: state.user_profile_snippet,
        theme_mode: state.theme_mode,
        app_settings: state.app_settings,
      }),
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return window.localStorage;
        return createNoopStorage();
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("useAuthStore hydration failed", error);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
