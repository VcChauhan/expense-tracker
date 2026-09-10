import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import connectMongo from '@/lib/mongodb';
import PushSubscription from '@/lib/models/PushSubscription';

export async function POST(req: Request) {
  try {
    const { title, body, icon, url } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    await connectMongo();
    const subscriptions = await PushSubscription.find({});

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found', sent: 0 });
    }

    let webpush: any;
    try {
      webpush = await import('web-push');
    } catch {
      console.warn('web-push module not installed or available');
      return NextResponse.json({ error: 'web-push module not installed', sent: 0 }, { status: 501 });
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:expense-tracker@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured in environment');
      return NextResponse.json({
        warning: 'VAPID keys missing. Please configure NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
        sent: 0,
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: url || '/' },
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
              },
            },
            payload
          );
          sent++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Expired or unsubscribed
            staleEndpoints.push(sub.endpoint);
          } else {
            console.error('Push send failed for endpoint:', sub.endpoint, err);
          }
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
    }

    return NextResponse.json({ success: true, sent, total: subscriptions.length });
  } catch (error: any) {
    console.error('Error triggering push notifications:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger push notifications' }, { status: 500 });
  }
}
