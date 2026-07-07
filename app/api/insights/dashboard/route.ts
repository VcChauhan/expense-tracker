import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import OpenAI from "openai";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'monthly'; // 'monthly' | 'annual'
    const mStr = searchParams.get('month'); // Used for monthly scope
    const yStr = searchParams.get('year');

    if (!yStr) {
      return NextResponse.json({ error: 'Missing year' }, { status: 400 });
    }
    if (scope === 'monthly' && !mStr) {
      return NextResponse.json({ error: 'Missing month' }, { status: 400 });
    }

    const year = parseInt(yStr);
    const month = mStr ? parseInt(mStr) : new Date().getMonth() + 1;
    
    // Set caching headers based on scope
    // CRITICAL: Using 'private' ensures only the user's browser caches this, preventing cross-user data leaks on the CDN
    const headers = new Headers();
    if (scope === 'annual') {
      headers.set('Cache-Control', 'private, max-age=86400'); // 24 hours in browser
    } else {
      headers.set('Cache-Control', 'private, max-age=900'); // 15 mins in browser
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ insights: [{ type: "general", message: "To enable Smart Insights, please add a GROQ_API_KEY to your environment variables." }] });
    }

    await connectMongo();
    const settings = await Settings.findOne();

    const monthStr = month.toString().padStart(2, '0');
    
    let currentExpenses = [];
    let historicalExpenses = [];

    if (scope === 'annual') {
      const regex = new RegExp(`^${year}-`);
      currentExpenses = await Expense.find({ date: { $regex: regex } });
      // For annual historical, we might compare vs last year, but to keep it simple and safe:
      // We will just aggregate the current year.
    } else {
      const regex = new RegExp(`^${year}-${monthStr}`);
      let m3 = month - 3;
      let y3 = year;
      if (m3 <= 0) { m3 += 12; y3 -= 1; }
      const m3Str = m3.toString().padStart(2, '0');
      const threeMonthsAgoPrefix = `${y3}-${m3Str}`;

      [currentExpenses, historicalExpenses] = await Promise.all([
        Expense.find({ date: { $regex: regex } }),
        Expense.find({ date: { $gte: threeMonthsAgoPrefix, $lt: `${year}-${monthStr}` } })
      ]);
    }

    if (!currentExpenses.length) {
      return NextResponse.json({ insights: [{ type: "general", message: `You haven't logged any expenses for this ${scope === 'annual' ? 'year' : 'month'} yet.` }] }, { headers });
    }

    const salary = settings?.monthlySalary || 0;
    const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);

    let payload: any = {};

    if (scope === 'annual') {
      const annualSalary = settings?.annualSalary || (salary * 12);
      const savingsRatePercentage = annualSalary > 0 ? ((annualSalary - totalSpent) / annualSalary) * 100 : 0;
      
      const categoriesPayload = (settings?.categories || []).map((c: any) => {
        const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
        return {
          name: c.name,
          annualBudgetLimit: c.monthlyBudget * 12,
          actualSpentThisYear: spent,
        };
      });

      payload = {
        currentYear: {
          yearId: year,
          totalSpent,
          savingsRatePercentage: Number(savingsRatePercentage.toFixed(1)),
          categories: categoriesPayload
        }
      };
    } else {
      const savingsRatePercentage = salary > 0 ? ((salary - totalSpent) / salary) * 100 : 0;
      const daysElapsed = new Date().getDate(); // approximate based on current day
      const totalDays = new Date(year, month, 0).getDate();
      const projectedMonthEndSpend = daysElapsed > 0 ? (totalSpent / daysElapsed) * totalDays : totalSpent;

      const histCatMap = new Map<string, number>();
      for (const exp of historicalExpenses) {
        histCatMap.set(exp.categoryId, (histCatMap.get(exp.categoryId) || 0) + exp.amount);
      }

      const categoriesPayload = (settings?.categories || []).map((c: any) => {
        const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
        const histTotal = histCatMap.get(c.id) || 0;
        return {
          name: c.name,
          budgetLimit: c.monthlyBudget,
          actualSpent: spent,
          historical3MonthAverage: Math.round(histTotal / 3)
        };
      });

      payload = {
        currentMonth: {
          monthId: `${year}-${monthStr}`,
          daysElapsed,
          totalDays,
          totalSpent,
          projectedMonthEndSpend: Math.round(projectedMonthEndSpend),
          savingsRatePercentage: Number(savingsRatePercentage.toFixed(1)),
          categories: categoriesPayload
        }
      };
    }

    console.log(`Sending AI Payload [context/dashboard/scope/${scope}]:`, JSON.stringify(payload, null, 2));

    const prompt = `
You are a highly intelligent personal finance assistant integrated into an Expense Tracker app.
Analyze the following user's aggregated ${scope === 'annual' ? 'yearly' : 'monthly'} spending data.
This data is purely mathematical (no sensitive info). 

Data:
${JSON.stringify(payload, null, 2)}

Task:
Write exactly 2 or 3 insightful, encouraging, and actionable pieces of financial advice for this ${scope === 'annual' ? 'year' : 'month'}.
Cover these areas if applicable:
1. "savings_coaching": Comment on their savings rate${scope === 'annual' ? ' for the year' : ' and projected spend'}.
2. "rebalancing": Notice if they are overspending in one category but saving in another, and suggest shifting budget.
3. "general": Any anomaly or positive trend.

Do not use robotic formatting. Use a conversational, friendly tone.

Respond strictly with a JSON array matching this schema:
{
  "insights": [
    {
      "type": "rebalancing" | "savings_coaching" | "general",
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

    return NextResponse.json({ insights: [{ type: "general", message: "Everything looks good!" }] }, { headers });
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('429')) {
      return NextResponse.json({ insights: [{ type: "general", message: "You're spending wisely! (AI insights temporarily paused due to API limits)." }] });
    }
    console.error('Error generating insights:', error);
    return NextResponse.json({ insights: [{ type: "general", message: "Insights unavailable right now." }] });
  }
}
