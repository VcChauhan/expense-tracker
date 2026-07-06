import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Suggestion from '@/lib/models/Suggestion';

export async function GET() {
  try {
    await connectMongo();
    // Only return pending suggestions
    const suggestions = await Suggestion.find({ status: 'pending' }).sort({ date: -1 });
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

// POST is the webhook for the Android companion app
export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Simple authentication for the webhook using a shared secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AUTH_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    await connectMongo();

    const suggestion = await Suggestion.create({
      smsBody: data.smsBody,
      sender: data.sender,
      amount: data.amount,
      date: data.date,
      status: 'pending',
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
