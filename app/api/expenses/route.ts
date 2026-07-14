import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 1-12
    const year = searchParams.get('year');   // 2026
    const categoryId = searchParams.get('categoryId');
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') ?? '200');

    // Build date filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    if (year && month) {
      const mm = String(month).padStart(2, '0');
      filter.date = { $gte: `${year}-${mm}-01`, $lte: `${year}-${mm}-31` };
    } else if (year) {
      filter.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }
    if (accountId) {
      filter.accountId = accountId;
    }

    const expenses = await Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('GET /api/expenses error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { date, categoryId, accountId, amount, note } = body;

    if (!date || !categoryId || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expense = await Expense.create({ date, categoryId, accountId: accountId || null, amount: parseFloat(amount), note: note ?? '' });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('POST /api/expenses error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
