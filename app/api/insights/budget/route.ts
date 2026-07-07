import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import OpenAI from "openai";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mStr = searchParams.get('month');
    const yStr = searchParams.get('year');

    if (!mStr || !yStr) {
      return NextResponse.json({ error: 'Missing month/year' }, { status: 400 });
    }

    const month = parseInt(mStr);
    const year = parseInt(yStr);
    
    // Cache for 15 mins (private to prevent cross-user CDN leakage)
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=900');

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ insights: [] }, { headers });
    }

    await connectMongo();

    const monthStr = month.toString().padStart(2, '0');
    const regex = new RegExp(`^${year}-${monthStr}`);

    const [currentExpenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!currentExpenses.length || !settings?.categories?.length) {
      return NextResponse.json({ insights: [] }, { headers });
    }

    const categoriesPayload = settings.categories.map((c: any) => {
      const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
      return {
        id: c.id,
        name: c.name,
        budgetLimit: c.monthlyBudget,
        actualSpent: spent,
      };
    });

    const payload = {
      categories: categoriesPayload
    };

    console.log(`Sending AI Payload [context/budget]:`, JSON.stringify(payload, null, 2));

    const prompt = `
You are a highly intelligent personal finance assistant integrated into an Expense Tracker app.
Analyze the following user's category spending vs budget for this month.
This data is purely mathematical (no sensitive info).

Data:
${JSON.stringify(payload, null, 2)}

Task:
Identify 1 to 3 categories that are significantly over-budget (or dangerously close to it). For each one, provide a very short, one-sentence advice (e.g., suggesting a budget rebalance from an underspent category).
Keep it extremely brief and direct. 

Respond strictly with a JSON array matching this schema:
{
  "insights": [
    {
      "categoryId": "the-exact-category-id-from-data",
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

    return NextResponse.json({ insights: [] }, { headers });
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429')) {
      return NextResponse.json({ insights: [] }, { headers }); // Silent fail for inline insights
    }
    console.error('Error generating budget insights:', error);
    return NextResponse.json({ insights: [] }, { headers });
  }
}
