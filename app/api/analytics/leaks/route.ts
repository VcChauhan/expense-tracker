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

    // Group by categoryId + normalized note keyword
    const groups: Record<string, { count: number; amounts: number[]; name: string; dates: string[] }> = {};

    expenses.forEach(exp => {
      const cleanName = (exp.note || 'Unnamed').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const key = `${exp.categoryId}-${cleanName}`;
      if (!groups[key]) {
        groups[key] = { count: 0, amounts: [], name: exp.note || 'Unnamed Charge', dates: [] };
      }
      groups[key].count += 1;
      groups[key].amounts.push(exp.amount);
      groups[key].dates.push(exp.date);
      if (exp.note && exp.note.length > groups[key].name.length) {
        groups[key].name = exp.note;
      }
    });

    const leaks = Object.values(groups)
      .filter(g => g.count >= 2 && g.amounts[0] > 0)
      .map(g => {
        const latestAmount = g.amounts[0];
        const prevAmount = g.amounts[1] || latestAmount;
        const isPriceHike = latestAmount > prevAmount && prevAmount > 0;
        const hikePercent = isPriceHike ? Math.round(((latestAmount - prevAmount) / prevAmount) * 100) : 0;

        return {
          name: g.name,
          amount: latestAmount,
          prevAmount,
          isPriceHike,
          hikePercent,
          frequency: g.count,
          lastCharged: g.dates[0],
          annualCost: latestAmount * 12
        };
      })
      .sort((a, b) => b.annualCost - a.annualCost);

    return NextResponse.json({ leaks });
  } catch (error: any) {
    console.error('Error fetching leaks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
