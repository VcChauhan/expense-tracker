import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = searchParams.get('month') ?? String(now.getMonth() + 1).padStart(2, '0');
    const year = searchParams.get('year') ?? String(now.getFullYear());

    const mm = String(month).padStart(2, '0');
    const dateFrom = `${year}-${mm}-01`;
    const dateTo = `${year}-${mm}-31`;

    // Per category totals for this month
    const categoryTotals = await Expense.aggregate([
      { $match: { date: { $gte: dateFrom, $lte: dateTo } } },
      {
        $group: {
          _id: '$categoryId',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Overall total
    const overall = categoryTotals.reduce((sum, c) => sum + c.total, 0);

    // Recent 5 expenses
    const recent = await Expense.find({ date: { $gte: dateFrom, $lte: dateTo } })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .lean();

    return NextResponse.json({ categoryTotals, overall, recent, month: mm, year });
  } catch (error) {
    console.error('GET /api/analytics/monthly error:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly analytics' }, { status: 500 });
  }
}
