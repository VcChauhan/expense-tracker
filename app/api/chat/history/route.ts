import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectMongo from '@/lib/mongodb';
import ChatHistory from '@/lib/models/ChatHistory';

export async function GET(req: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    const authHeader = req.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('iq-session')?.value;

    if ((!authHeader || authHeader !== `Bearer ${secret}`) && (!sessionCookie || sessionCookie !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = 'admin';

    await connectMongo();
    const history = await ChatHistory.find({ userId }).sort({ createdAt: 1 }).limit(100);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    const authHeader = req.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('iq-session')?.value;

    if ((!authHeader || authHeader !== `Bearer ${secret}`) && (!sessionCookie || sessionCookie !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = 'admin';

    await connectMongo();
    await ChatHistory.deleteMany({ userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  }
}
