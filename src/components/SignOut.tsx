import { useRouter } from "next/navigation";
import ConfirmationModal from "./ConfirmationModal";
import { useGlobalLoading } from "@/context/GlobalLoadingContext";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAndClearClientState } from "@/lib/auth/clientSignOut";

export default function SignOutModal({ showSignOutConfirm, setShowSignOutConfirm }: { showSignOutConfirm: boolean, setShowSignOutConfirm: (value: boolean) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setIsLoading } = useGlobalLoading();

  /** Sign out and redirect to login */
  const handleSignOut = async () => {
    setIsLoading(true);

    await signOutAndClearClientState(queryClient);
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
