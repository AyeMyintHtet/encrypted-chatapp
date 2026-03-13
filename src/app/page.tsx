import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Home page: redirects to dashboard if authenticated, or login if not.
 */
export default async function Home() {
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
