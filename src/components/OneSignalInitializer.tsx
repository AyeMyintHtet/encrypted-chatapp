"use client";

import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";
import {
  ONESIGNAL_APP_ID,
  ONESIGNAL_SERVICE_WORKER_PATH,
  ONESIGNAL_SERVICE_WORKER_SCOPE,
  ONESIGNAL_SERVICE_WORKER_UPDATER_PATH,
} from "@/lib/onesignal/config";

const PROMPTED_PERMISSION_KEY_PREFIX = "onesignal-prompted-push";

async function promptPushPermissionOncePerUser(userId: string) {
  if (!OneSignal.Notifications.isPushSupported()) return;

  const promptKey = `${PROMPTED_PERMISSION_KEY_PREFIX}:${userId}`;
  if (localStorage.getItem(promptKey) === "1") return;

  const permission = OneSignal.Notifications.permissionNative;
  if (permission === "default") {
    await OneSignal.Notifications.requestPermission();
  }

  localStorage.setItem(promptKey, "1");
}

export default function OneSignalInitializer() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    const pushSubscriptionChangeListener = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncAuthenticatedUser(session?.user ?? null);
    };
    const supabase = createClient();

    const syncAuthenticatedUser = async (user: User | null) => {
      if (!isMounted) return;

      const nextExternalId = user?.id ?? null;
      const currentExternalId = OneSignal.User.externalId ?? null;

      if (!nextExternalId) {
        if (currentExternalId) {
          await OneSignal.logout();
        }
        return;
      }

      if (currentExternalId && currentExternalId !== nextExternalId) {
        await OneSignal.logout();
      }

      if (OneSignal.User.externalId !== nextExternalId) {
        await OneSignal.login(nextExternalId);
      }

      await promptPushPermissionOncePerUser(nextExternalId);
    };

    const init = async () => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: ONESIGNAL_SERVICE_WORKER_PATH,
          serviceWorkerUpdaterPath: ONESIGNAL_SERVICE_WORKER_UPDATER_PATH,
          serviceWorkerParam: { scope: ONESIGNAL_SERVICE_WORKER_SCOPE },
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== "production",
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncAuthenticatedUser(session?.user ?? null);

        OneSignal.User.PushSubscription.addEventListener(
          "change",
          pushSubscriptionChangeListener
        );

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
          await syncAuthenticatedUser(currentSession?.user ?? null);
        });
        authSubscription = subscription;
      } catch (error) {
        console.warn("OneSignal init skipped:", error);
      }
    };

    void init();

    return () => {
      isMounted = false;
      OneSignal.User.PushSubscription.removeEventListener(
        "change",
        pushSubscriptionChangeListener
      );
      authSubscription?.unsubscribe();
    };
  }, []);

  return null;
}
