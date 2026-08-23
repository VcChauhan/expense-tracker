import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import connectMongo from '@/lib/mongodb';
import Suggestion from '@/lib/models/Suggestion';

function scrubSms(text: string): string {
  if (!text) return text;
  return text
    .replace(/[Xx]{2,}\d+/g, '[ACCOUNT]')
    .replace(/\b\d{8,}\b/g, '[ID]')
    .replace(/UPI\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/?/gi, 'UPI/[REDACTED]/');
}

export async function GET() {
  try {
    await connectMongo();
    const suggestions = await Suggestion.find({ status: 'pending' }).sort({ date: -1 });
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AUTH_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    await connectMongo();

    const suggestedCategory = data.suggestedCategory || 'general';
    const suggestedLabel = data.suggestedLabel || (data.smsBody ? 'UPI Payment' : 'On-Device Expense');
    const suggestedTags = data.suggestedTags || [];

    const suggestion = await Suggestion.create({
      smsBody: data.smsBody ? scrubSms(data.smsBody) : 'On-Device Private SMS',
      sender: data.sender || 'Bank SMS',
      amount: data.amount,
      date: data.date,
      status: 'pending',
      suggestedCategory,
      suggestedLabel,
      suggestedTags,
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
