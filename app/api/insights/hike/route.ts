import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import OpenAI from "openai";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yStr = searchParams.get('year');
    const pStr = searchParams.get('hikePercent');

    if (!yStr || !pStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const year = parseInt(yStr);
    const hikePercent = parseFloat(pStr);
    
    // No cache for hike planner (interactive simulation)
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, max-age=0');

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ insights: [{ type: "hike_advice", message: "To enable Smart Insights, please add a GROQ_API_KEY to your environment variables." }] }, { headers });
    }

    await connectMongo();

    const regex = new RegExp(`^${year}-`);
    const [expenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!settings?.categories?.length) {
      return NextResponse.json({ insights: [] }, { headers });
    }

    const categoriesPayload = settings.categories.map((c: any) => {
      const spent = expenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
      const currentBudgetMonthly = c.monthlyBudget;
      const proposedBudgetMonthly = Math.round(c.monthlyBudget * (1 + hikePercent / 100));
      return {
        name: c.name,
        currentAnnualBudget: currentBudgetMonthly * 12,
        proposedAnnualBudget: proposedBudgetMonthly * 12,
        actualSpentThisYear: spent,
      };
    });

    const payload = {
      simulationYear: year,
      hikePercent,
      categories: categoriesPayload
    };

    console.log(`Sending AI Payload [context/hike]:`, JSON.stringify(payload, null, 2));

    const prompt = `
You are a highly intelligent personal finance assistant integrated into an Expense Tracker app.
Analyze the following user's salary hike simulation and category spending data for this year.
This data is purely mathematical (no sensitive info).

Data:
${JSON.stringify(payload, null, 2)}

Task:
Write exactly 1 or 2 insightful pieces of advice about how they should allocate their ${hikePercent}% hike across their category budgets.
For example: Recommend shifting more of the hike to categories where they frequently overspend, rather than just equally boosting all categories by ${hikePercent}%.
Use a conversational, friendly tone. Do not use robotic formatting. Keep it brief.

Respond strictly with a JSON array matching this schema:
{
  "insights": [
    {
      "type": "hike_advice",
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
      return NextResponse.json({ insights: [{ type: "hike_advice", message: "Looks like a great hike! (AI insights temporarily paused due to API limits)." }] }, { headers });
    }
    console.error('Error generating hike insights:', error);
    return NextResponse.json({ insights: [] }, { headers });
  }
}
