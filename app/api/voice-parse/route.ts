import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Settings from '@/lib/models/Settings';
import { parseVoiceInputLocally } from '@/lib/localInsights';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    await connectMongo();
    const settings = await Settings.findOne();
    const categories = settings?.categories || [];
    
    if (categories.length === 0) {
      return NextResponse.json({ error: 'No categories available' }, { status: 400 });
    }

    const parsed = parseVoiceInputLocally(text, categories);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Voice parse error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
