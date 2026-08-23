import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { generateLocalDashboardInsights } from '@/lib/localInsights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yStr = searchParams.get('year');

    if (!yStr) {
      return NextResponse.json({ error: 'Missing year' }, { status: 400 });
    }

    const year = parseInt(yStr);
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=900');

    await connectMongo();

    const regex = new RegExp(`^${year}-`);
    const [expenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

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

    const localInsights = generateLocalDashboardInsights({ currentYear: { totalSpent: expenses.reduce((s, e) => s + e.amount, 0), categories: categoriesPayload } }, 'annual');
    return NextResponse.json({ insights: localInsights }, { headers });
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ insights: [{ type: "category_drift", message: "Your category trends are stable!" }] });
  }
}
