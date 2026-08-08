import { NextResponse } from 'next/server';
import OpenAI from "openai";
import connectMongo from '@/lib/mongodb';
import Settings from '@/lib/models/Settings';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
    }

    await connectMongo();
    const settings = await Settings.findOne();
    const categories = settings?.categories || [];
    
    if (categories.length === 0) {
      return NextResponse.json({ error: 'No categories available' }, { status: 400 });
    }

    const categoryList = categories.map((c: any) => `- ID: ${c.id}, Name: ${c.name}`).join('\n');

    const prompt = `
You are an expert personal finance assistant. 
Extract the expense details from the following user transcription: "${text}"

Available Categories:
${categoryList}

Rules:
1. Extract the numerical amount. If no exact amount is found, return 0.
2. Select the MOST APPROPRIATE category ID from the Available Categories list based on the context. If nothing matches, select the most generic one (e.g., Miscellaneous).
3. Write a short, clean note (max 3-4 words) describing the purchase (e.g., "Uber ride", "Coffee at Starbucks").

Respond ONLY with a valid JSON object matching this schema:
{
  "amount": 150,
  "categoryId": "category-id-here",
  "note": "short note"
}
`;

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0]?.message?.content;

    if (responseContent) {
      const parsed = JSON.parse(responseContent);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });

  } catch (error: any) {
    console.error('Voice parse error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
