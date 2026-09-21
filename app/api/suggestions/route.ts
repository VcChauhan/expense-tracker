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
    let suggestedPaymentMethod = data.suggestedPaymentMethod || 'upi';
    if (suggestedPaymentMethod.startsWith('credit_card:')) {
      suggestedPaymentMethod = suggestedPaymentMethod.replace(/^credit_card:xx/i, 'credit_card:');
    }
    const smsBody = data.smsBody || '';
    const bodyLower = smsBody.toLowerCase();

    // Safety Filter: Reject promotional & offer SMS from creating pending suggestions
    const promoKeywords = ['discount', 'instant discount', 'flexipay', 'min. trxn', 'min trxn', 'max. discount', 'offer valid', 'valid till', 'book now', 'apply for', 'processing fee', 'convert your'];
    if (suggestedLabel.startsWith('⚠️ Ignore:') || promoKeywords.some(kw => bodyLower.includes(kw))) {
      return NextResponse.json({ status: 'ignored', message: 'Promotional / Non-expense SMS ignored' });
    }

    const suggestion = await Suggestion.create({
      smsBody: data.smsBody ? scrubSms(data.smsBody) : 'On-Device Private SMS',
      sender: data.sender || 'Bank SMS',
      amount: data.amount,
      date: data.date,
      status: 'pending',
      suggestedCategory,
      suggestedLabel,
      suggestedTags,
      suggestedPaymentMethod,
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
