import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { receiver_id, sender_name } = await req.json();
    
    if (!receiver_id || !sender_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "788c64e8-1513-4d95-8391-404813c2d5df";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
      return NextResponse.json({ error: 'OneSignal REST API key missing from server environment.' }, { status: 500 });
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [receiver_id] },
      target_channel: "push",
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

    // Gracefully handle expected OneSignal states where the receiver hasn't logged in
    // or hasn't accepted push notification permissions yet. 
    // We don't want to throw 500 errors for these; they are normal user states.
    if (data.errors) {
      const hasInvalidAlias = data.errors.invalid_aliases;
      const isUnsubscribed = Array.isArray(data.errors) && data.errors.includes("All included players are not subscribed");
      
      if (hasInvalidAlias || isUnsubscribed) {
        return NextResponse.json({ 
          success: true, 
          message: 'Notification skipped. Receiver is not registered or subscribed to push notifications yet.' 
        });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error while sending notification' }, { status: 500 });
  }
}
