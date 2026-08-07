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
    
    let currentExpenses: any[] = [];
    let historicalExpenses: any[] = [];

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
      const prevMonthCatMap = new Map<string, number>();
      
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
      const prevMonthPrefix = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
      let prevTotalSpent = 0;

      for (const exp of historicalExpenses) {
        histCatMap.set(exp.categoryId, (histCatMap.get(exp.categoryId) || 0) + exp.amount);
        if (exp.date.startsWith(prevMonthPrefix)) {
          prevMonthCatMap.set(exp.categoryId, (prevMonthCatMap.get(exp.categoryId) || 0) + exp.amount);
          prevTotalSpent += exp.amount;
        }
      }

      const categoriesPayload = (settings?.categories || []).map((c: any) => {
        const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
        const histTotal = histCatMap.get(c.id) || 0;
        const prevTotal = prevMonthCatMap.get(c.id) || 0;
        return {
          name: c.name,
          budgetLimit: c.monthlyBudget,
          actualSpent: spent,
          spentLastMonth: prevTotal,
          historical3MonthAverage: Math.round(histTotal / 3)
        };
      });

      payload = {
        currentMonth: {
          monthId: `${year}-${monthStr}`,
          daysElapsed,
          totalDays,
          totalSpent,
          prevMonthTotalSpent: prevTotalSpent,
          projectedMonthEndSpend: Math.round(projectedMonthEndSpend),
          savingsRatePercentage: Number(savingsRatePercentage.toFixed(1)),
          categories: categoriesPayload
        }
      };
    }

    console.log(`Sending AI Payload [context/dashboard/scope/${scope}]:`, JSON.stringify(payload, null, 2));

    const prompt = `
You are the Chief Financial Officer (CFO) AI for the user. 
Analyze the user's aggregated spending data. Compare the current month against BOTH last month and the 3-month average to provide deep insights.
This data is purely mathematical (no sensitive info). 

Data:
${JSON.stringify(payload, null, 2)}

Task:
Generate a comprehensive, encouraging, and highly actionable financial briefing.
If they haven't spent much this month, focus on their good pace or their historical spending patterns.

Respond strictly with a JSON object matching this exact schema:
{
  "executiveSummary": "A 2-3 sentence overview of their month, praising wins and highlighting the main concern. Reference long-term trends if relevant.",
  "momComparisons": [
    {
      "category": "Category Name",
      "trend": "up" | "down" | "flat",
      "difference": 1200, 
      "analysis": "1 sentence explaining if this is good or bad and why, referencing the 3-month average if it adds valuable context."
    }
  ],
  "actionableSteps": [
    "A concrete, specific action they can take this week to improve their finances."
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
      return NextResponse.json({ report: parsed, rawData: payload }, { headers });
    }

    return NextResponse.json({ error: "Failed to generate report" }, { status: 500, headers });
  } catch (error: any) {
    console.error('Error generating full insights:', error);
    return NextResponse.json({ error: "Insights unavailable right now." }, { status: 500 });
  }
}
