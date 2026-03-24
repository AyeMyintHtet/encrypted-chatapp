import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { receiver_id, sender_name } = await req.json();
    
    if (!receiver_id || !sender_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID =
      process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
      "788c64e8-1513-4d95-8391-404813c2d5df";
    const ONESIGNAL_TEMPLATE_ID =
      process.env.ONESIGNAL_TEMPLATE_ID ||
      "f31945d1-8ef0-4de9-819e-240a4959f5a5";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
      return NextResponse.json({ error: 'OneSignal REST API key missing from server environment.' }, { status: 500 });
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: [receiver_id],
      },
      target_channel: "push",
      template_id: ONESIGNAL_TEMPLATE_ID,
      custom_data: {
        sender_name,
      },
      // Fallback text if template content cannot be rendered.
      headings: { en: "CQgram Secure" },
      contents: { en: `New encrypted message from ${sender_name}` }
    };
    console.log("Payload:", payload);
    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: 'OneSignal request failed.',
          status: response.status,
          data,
        },
        { status: 502 }
      );
    }

    // Output exact OneSignal errors to Next.js console to understand exactly why it failed
    if (data.errors) {
      console.warn("OneSignal Explicit Errors:", data.errors);
      return NextResponse.json({ 
        success: false, 
        message: 'Notification skipped with exact OneSignal API error.',
        onesignal_errors: data.errors 
      }, { status: 200 }); // Keep 200 so UI doesn't crash, but expose errors to network tab
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
        data,
      });
    }

    return NextResponse.json({ success: true, delivered: true, data });
  } catch {
    return NextResponse.json({ error: 'Internal server error while sending notification' }, { status: 500 });
  }
}
