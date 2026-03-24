import { useRouter } from "next/navigation";
import ConfirmationModal from "./ConfirmationModal";
import { useGlobalLoading } from "@/context/GlobalLoadingContext";
import { useAppStore } from "@/store/useAppStore";

export default function SignOutModal({ showSignOutConfirm, setShowSignOutConfirm }: { showSignOutConfirm: boolean, setShowSignOutConfirm: (value: boolean) => void }) {
  const router = useRouter();
  const { setIsLoading } = useGlobalLoading();

  /** Sign out and redirect to login */
  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }

    // Fully clear global Zustand application state and local storage cache
    useAppStore.getState().clearStore();
    useAppStore.persist.clearStorage();

    // Completely wipe out frontend cookies to prevent lingering stale sessions
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });

    // Unlink device from OneSignal so they don't get push notifications for this account
    if (typeof window !== "undefined") {
      const OneSignalDeferred = (window as any).OneSignalDeferred || [];
      OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.logout();
      });
    }

    // Wipe all browser storage to ensure a clean slate, except for global theme setup
    const savedTheme = localStorage.getItem("chatapp-theme");
    localStorage.clear();
    sessionStorage.clear();
    if (savedTheme) {
      localStorage.setItem("chatapp-theme", savedTheme);
    }
    router.push("/login");

    router.refresh();
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <ConfirmationModal
      isOpen={showSignOutConfirm}
      onClose={() => setShowSignOutConfirm(false)}
      onConfirm={handleSignOut}
      title="Sign Out"
      message="Are you sure you want to sign out from your account?"
      confirmText="Sign Out"
    />
  )
}