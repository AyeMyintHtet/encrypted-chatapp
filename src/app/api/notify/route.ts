import { NextResponse } from 'next/server';
import { ONESIGNAL_APP_ID } from '@/lib/onesignal/config';

type NotifyRequestBody = {
  receiver_id?: string;
  receiver_ids?: string[];
  sender_name?: string;
  message?: string;
  web_url?: string;
};

function getReceiverIds(body: NotifyRequestBody): string[] {
  const merged = [
    ...(typeof body.receiver_id === "string" ? [body.receiver_id] : []),
    ...(Array.isArray(body.receiver_ids) ? body.receiver_ids : []),
  ];

  return [...new Set(merged.map((id) => id.trim()).filter(Boolean))];
}

async function readOneSignalResponse(response: Response): Promise<{
  parsed: unknown;
  raw: string | null;
}> {
  const raw = await response.text().catch(() => "");
  if (!raw) return { parsed: null, raw: null };

  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    return { parsed: null, raw };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotifyRequestBody;
    const senderName = body.sender_name?.trim() ?? "";
    const receiverIds = getReceiverIds(body);
    
    if (receiverIds.length === 0 || !senderName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
      return NextResponse.json({ error: 'OneSignal REST API key missing from server environment.' }, { status: 500 });
    }

    const safeMessage = body.message?.trim();
    const safeWebUrl = body.web_url?.trim();

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: receiverIds,
      },
      target_channel: "push",
      isAnyWeb: true,
      headings: { en: "CQgram Secure" },
      contents: { en: safeMessage || `New encrypted message from ${senderName}` },
      ...(safeWebUrl ? { web_url: safeWebUrl } : {}),
    };

    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const { parsed, raw } = await readOneSignalResponse(response);

    if (!response.ok) {
      console.warn("[notify] OneSignal request failed", {
        status: response.status,
        statusText: response.statusText,
        response: parsed ?? raw,
      });
      return NextResponse.json(
        {
          success: false,
          message: 'OneSignal request failed.',
          onesignal_status: response.status,
          onesignal_status_text: response.statusText,
          onesignal_response: parsed ?? raw,
        },
        { status: 502 }
      );
    }

    const data = parsed as
      | {
          errors?: unknown;
          warnings?: { invalid_external_user_ids?: string };
        }
      | null;

    if (data?.errors) {
      console.warn("OneSignal Explicit Errors:", data.errors);
      return NextResponse.json({ 
        success: false, 
        message: 'Notification skipped with exact OneSignal API error.',
        onesignal_errors: data.errors,
        onesignal_response: data,
      }, { status: 200 });
    }

    const invalidExternalIdsWarning =
      typeof data?.warnings?.invalid_external_user_ids === "string"
        ? data.warnings.invalid_external_user_ids
        : null;

    if (invalidExternalIdsWarning) {
      return NextResponse.json({
        success: true,
        delivered: false,
        reason: "recipient_unsubscribed",
        warning: invalidExternalIdsWarning,
        onesignal_response: data,
      });
    }

    return NextResponse.json({ success: true, delivered: true, onesignal_response: data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[notify] Internal error:", errorMessage);
    return NextResponse.json(
      {
        error: 'Internal server error while sending notification',
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
