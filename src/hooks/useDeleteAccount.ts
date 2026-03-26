import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOutAndClearClientState } from "@/lib/auth/clientSignOut";
import { useRouter } from "next/navigation";

/** Valid grace period options for account deletion */
export const DELETION_PERIODS = [
  { days: 7, label: "7 Days" },
  { days: 30, label: "1 Month" },
  { days: 90, label: "3 Months" },
] as const;

export type DeletionPeriodDays = (typeof DELETION_PERIODS)[number]["days"];

/**
 * Hook to schedule account deletion with a chosen grace period.
 * After scheduling, the user is automatically signed out.
 * Logging back in will auto-cancel the deletion via the cron job
 * (it checks auth.users.last_sign_in_at > deletion_scheduled_at).
 */
export function useScheduleDeletion() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (periodDays: DeletionPeriodDays) => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", period_days: periodDays }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to schedule deletion");
      }

      return periodDays;
    },
    // After successful scheduling, sign the user out immediately
    onSuccess: async () => {
      await signOutAndClearClientState(queryClient);
      router.push("/login");
    },
  });
}
