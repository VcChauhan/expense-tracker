import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import connectMongo from '@/lib/mongodb';
import PushSubscription from '@/lib/models/PushSubscription';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data || !data.endpoint || !data.keys || !data.keys.p256dh || !data.keys.auth) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    await connectMongo();

    // Upsert subscription
    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint: data.endpoint },
      {
        endpoint: data.endpoint,
        keys: {
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
        },
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, id: sub._id });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: error.message || 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
    }

    await connectMongo();
    await PushSubscription.deleteOne({ endpoint });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove subscription' }, { status: 500 });
  }
}
