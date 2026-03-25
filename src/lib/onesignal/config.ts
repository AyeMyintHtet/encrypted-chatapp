export const DEFAULT_ONESIGNAL_APP_ID = "c52d93fb-9aef-44b4-bcc4-601315c2f697";

export const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? DEFAULT_ONESIGNAL_APP_ID;

export const ONESIGNAL_SERVICE_WORKER_PATH = "/OneSignalSDKWorker.js";
export const ONESIGNAL_SERVICE_WORKER_UPDATER_PATH =
  "/OneSignalSDKUpdaterWorker.js";
export const ONESIGNAL_SERVICE_WORKER_SCOPE = "/";
