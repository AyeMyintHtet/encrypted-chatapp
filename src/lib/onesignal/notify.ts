"use client";

type SendPushNotificationInput = {
  receiverId?: string;
  receiverIds?: string[];
  senderName: string;
  message?: string;
  webUrl?: string;
};

function normalizeReceiverIds({
  receiverId,
  receiverIds,
}: Pick<SendPushNotificationInput, "receiverId" | "receiverIds">): string[] {
  const merged = [
    ...(typeof receiverId === "string" ? [receiverId] : []),
    ...(Array.isArray(receiverIds) ? receiverIds : []),
  ];

  return [...new Set(merged.map((id) => id.trim()).filter(Boolean))];
}

export async function sendPushNotification({
  receiverId,
  receiverIds,
  senderName,
  message,
  webUrl,
}: SendPushNotificationInput): Promise<void> {
  const normalizedReceiverIds = normalizeReceiverIds({ receiverId, receiverIds });
  if (normalizedReceiverIds.length === 0) return;

  const safeSenderName = senderName.trim();
  if (!safeSenderName) return;

  const requestPayload = {
    receiver_ids: normalizedReceiverIds,
    sender_name: safeSenderName,
    ...(message ? { message } : {}),
    ...(webUrl ? { web_url: webUrl } : {}),
  };

  try {
    const response = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          delivered?: boolean;
          warning?: string;
          message?: string;
          onesignal_status?: number;
          onesignal_status_text?: string;
          onesignal_response?: unknown;
          detail?: string;
        }
      | null;

    if (!response.ok || payload?.success === false || payload?.delivered === false) {
      console.warn("[push:/api/notify] Failed or not delivered", {
        http_status: response.status,
        request: requestPayload,
        api_response: payload,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("[push:/api/notify] Network or client error", {
      request: requestPayload,
      error: errorMessage,
    });
    // Best-effort push path only; chat send flow should continue.
  }
}
