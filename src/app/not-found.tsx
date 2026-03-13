import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Custom 404 (Not Found) page: 
 * Redirects to dashboard if authenticated, or login if not.
 */
export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
