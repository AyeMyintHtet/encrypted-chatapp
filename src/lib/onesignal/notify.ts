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

  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiver_ids: normalizedReceiverIds,
        sender_name: safeSenderName,
        ...(message ? { message } : {}),
        ...(webUrl ? { web_url: webUrl } : {}),
      }),
    });
  } catch {
    // Best-effort push path only; chat send flow should continue.
  }
}
