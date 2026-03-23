import { useRouter } from "next/navigation";
import ConfirmationModal from "./ConfirmationModal";

export default function SignOutModal({ showSignOutConfirm, setShowSignOutConfirm }: { showSignOutConfirm: boolean, setShowSignOutConfirm: (value: boolean) => void }) {
  const router = useRouter();
  /** Sign out and redirect to login */
  const handleSignOut = async () => {
    // Note: It's better to rely on Supabase directly to log out the user,
    // though createClient could have been kept, we recreate it here specifically for log out.
    // Or we can import explicitly.
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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