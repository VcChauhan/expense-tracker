import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ?? new Date().getFullYear().toString();

    // Aggregate spending per category per month for the given year
    const results = await Expense.aggregate([
      {
        $match: {
          date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
        },
      },
      {
        $addFields: {
          month: { $substr: ['$date', 5, 2] }, // Extract MM from YYYY-MM-DD
        },
      },
      {
        $group: {
          _id: { month: '$month', categoryId: '$categoryId' },
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.month': 1 },
      },
    ]);

    // Also compute per-month totals
    const monthTotals = await Expense.aggregate([
      {
        $match: {
          date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
        },
      },
      {
        $addFields: {
          month: { $substr: ['$date', 5, 2] },
        },
      },
      {
        $group: {
          _id: '$month',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return NextResponse.json({ categoryMonthly: results, monthTotals, year });
  } catch (error) {
    console.error('GET /api/analytics/annual error:', error);
    return NextResponse.json({ error: 'Failed to fetch annual analytics' }, { status: 500 });
  }
}
