import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import OpenAI from "openai";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yStr = searchParams.get('year');

    if (!yStr) {
      return NextResponse.json({ error: 'Missing year' }, { status: 400 });
    }

    const year = parseInt(yStr);
    
    // Cache for 15 mins (private to prevent cross-user CDN leakage)
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=900');

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ insights: [{ type: "category_drift", message: "To enable Smart Insights, please add a GROQ_API_KEY to your environment variables." }] }, { headers });
    }

    await connectMongo();

    const regex = new RegExp(`^${year}-`);
    const [expenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!expenses.length) {
      return NextResponse.json({ insights: [{ type: "category_drift", message: "You haven't logged any expenses for this year yet." }] }, { headers });
    }

    const categoriesPayload = (settings?.categories || []).map((c: any) => {
      const monthlySpend: Record<string, number> = {};
      const catExpenses = expenses.filter(e => e.categoryId === c.id);
      for (let i = 1; i <= 12; i++) {
        const mm = String(i).padStart(2, '0');
        const monthSpent = catExpenses.filter(e => e.date.startsWith(`${year}-${mm}`)).reduce((s, e) => s + e.amount, 0);
        if (monthSpent > 0) monthlySpend[mm] = monthSpent;
      }
      return { name: c.name, monthlySpend };
    }).filter(c => Object.keys(c.monthlySpend).length > 0);

    const payload = { year, categories: categoriesPayload };

    console.log(`Sending AI Payload [context/reports]:`, JSON.stringify(payload, null, 2));

    const prompt = `
You are a highly intelligent personal finance assistant integrated into an Expense Tracker app.
Analyze the following user's yearly category spending data month-by-month.
This data is purely mathematical (no sensitive info).

Data:
${JSON.stringify(payload, null, 2)}

Task:
Write exactly 1 or 2 insightful pieces of advice about "category drift" (how category spending has shifted over time this year).
For example: Notice if a category's spend has been steadily increasing or dropping, or if it suddenly spiked.
Use a conversational, friendly tone. Do not use robotic formatting. Keep it relatively brief.

Respond strictly with a JSON array matching this schema:
{
  "insights": [
    {
      "type": "category_drift",
      "message": "The insight text..."
    }
  ]
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
      return NextResponse.json({ insights: parsed.insights }, { headers });
    }

    return NextResponse.json({ insights: [{ type: "category_drift", message: "Your category trends are stable!" }] }, { headers });
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429')) {
      return NextResponse.json({ insights: [{ type: "category_drift", message: "Your category trends are stable! (AI insights temporarily paused due to API limits)." }] });
    }
    console.error('Error generating insights:', error);
    return NextResponse.json({ insights: [{ type: "category_drift", message: "Insights unavailable right now." }] });
  }
}
