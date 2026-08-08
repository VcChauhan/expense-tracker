import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

export async function GET(req: Request) {
  try {
    await connectMongo();
    
    // Get date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const expenses = await Expense.find({ date: { $gte: dateStr } }).sort({ date: -1 });

    // Group by amount + categoryId
    const groups: Record<string, { count: number; amount: number; name: string; dates: string[] }> = {};

    expenses.forEach(exp => {
      // Ignore very small or very large charges from recurring checks unless they match exactly
      const key = `${exp.amount}-${exp.categoryId}`;
      if (!groups[key]) {
        groups[key] = { count: 0, amount: exp.amount, name: exp.note || 'Unnamed Charge', dates: [] };
      }
      groups[key].count += 1;
      groups[key].dates.push(exp.date);
      // Prefer longer notes for the name
      if (exp.note && exp.note.length > groups[key].name.length) {
        groups[key].name = exp.note;
      }
    });

    const leaks = Object.values(groups)
      .filter(g => g.count >= 2 && g.amount > 0)
      .map(g => ({
        name: g.name,
        amount: g.amount,
        frequency: g.count,
        lastCharged: g.dates[0], // it's sorted descending
        annualCost: g.amount * 12
      }))
      .sort((a, b) => b.annualCost - a.annualCost);

    return NextResponse.json({ leaks });
  } catch (error: any) {
    console.error('Error fetching leaks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
