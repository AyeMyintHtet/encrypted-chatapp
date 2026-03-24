"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";

export default function OneSignalInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: "788c64e8-1513-4d95-8391-404813c2d5df",
          allowLocalhostAsSecureOrigin: true, // For development
          notifyButton: {
            enable: true,
          } as any,
        });

        // Identify the user reactively as soon as Supabase Auth state connects
        const supabase = createClient();
        
        // Grab immediate session if available
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await OneSignal.login(session.user.id);
        }

        // Keep it heavily synced if they sign in/out natively in the same session
        supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession?.user?.id) {
            await OneSignal.login(currentSession.user.id);
          }
        });
      } catch (err) {
        // OneSignal usually throws if adblocker is active or in incognito, safely ignore
        console.warn("OneSignal Initialization Skipped:", err);
      }
    };

    initOneSignal();
  }, []);

  return null;
}