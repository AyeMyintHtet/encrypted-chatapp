"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";

export default function OneSignalInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initOneSignal = async () => {
      try {
        const appId =
          process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ??
          "788c64e8-1513-4d95-8391-404813c2d5df";

        await OneSignal.init({
          appId,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/" },
          allowLocalhostAsSecureOrigin: true, // For development
          notifyButton: {
            enable: true,
          },
        });

        // Identify the user reactively as soon as Supabase Auth state connects
        const supabase = createClient();
        const syncOneSignalUser = async (externalId: string | null) => {
          try {
            if (!isMounted) return;

            const currentExternalId = OneSignal.User.externalId ?? null;
            if (!externalId) {
              if (currentExternalId) {
                await OneSignal.logout();
              }
              return;
            }

            // If account changed in this browser, detach previous alias first.
            if (currentExternalId && currentExternalId !== externalId) {
              await OneSignal.logout();
            }

            if (OneSignal.User.externalId !== externalId) {
              await OneSignal.login(externalId);
            }
          } catch (syncErr) {
            console.warn("OneSignal user sync skipped:", syncErr);
          }
        };

        // Grab immediate session if available
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncOneSignalUser(session?.user?.id ?? null);

        // Keep OneSignal user context synced with Supabase auth changes.
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
          await syncOneSignalUser(currentSession?.user?.id ?? null);
        });
        authSubscription = subscription;
      } catch (err) {
        // OneSignal usually throws if adblocker is active or in incognito, safely ignore
        console.warn("OneSignal Initialization Skipped:", err);
      }
    };

    initOneSignal();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  return null;
}
