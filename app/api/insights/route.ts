import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { GoogleGenAI, Type } from '@google/genai';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mStr = searchParams.get('month');
    const yStr = searchParams.get('year');

    if (!mStr || !yStr) {
      return NextResponse.json({ error: 'Missing month/year' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ insight: "To enable Smart Insights, please add a GEMINI_API_KEY to your environment variables." });
    }

    await connectMongo();

    const month = parseInt(mStr);
    const year = parseInt(yStr);
    const monthStr = month.toString().padStart(2, '0');
    const regex = new RegExp(`^${year}-${monthStr}`);

    const [expenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!expenses.length) {
      return NextResponse.json({ insight: "You haven't logged any expenses for this month yet. Start tracking to get personalized insights!" });
    }

    // Prepare data for Gemini
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const salary = settings?.monthlySalary || 0;
    
    // Group by category
    const catMap = new Map<string, number>();
    for (const exp of expenses) {
      const cat = settings?.categories?.find((c: any) => c.id === exp.categoryId);
      const catName = cat ? cat.name : 'Other';
      catMap.set(catName, (catMap.get(catName) || 0) + exp.amount);
    }
    
    const breakdown = Array.from(catMap.entries())
      .map(([name, amount]) => `${name}: ₹${amount}`)
      .join('\n');

    const prompt = `
You are a friendly, highly intelligent personal finance assistant integrated into an Expense Tracker app.
Analyze the following user's monthly spending data:

Monthly Income: ₹${salary}
Total Spent this month: ₹${totalSpent}
Category Breakdown:
${breakdown}

Task:
Write a very brief (max 2 sentences), encouraging, and actionable piece of financial advice or insight based on their data. 
Do not use robotic formatting (no bullet points). Use a conversational, friendly tone. If they are overspending, gently warn them. If they are saving well, praise them.
Respond strictly with a JSON object containing a single key "insight".
`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return NextResponse.json({ insight: parsed.insight });
    }

    return NextResponse.json({ insight: "Everything looks good this month!" });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
