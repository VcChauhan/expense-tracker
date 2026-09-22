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
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const paymentMethod = searchParams.get('paymentMethod');

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

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    // Self-healing migration: Clean up any legacy 'credit_card:xx' records in database
    try {
      const legacy = await Expense.find({ paymentMethod: { $regex: /^credit_card:xx/i } }).select('_id paymentMethod').lean();
      if (legacy.length > 0) {
        for (const item of legacy) {
          const cleanMethod = (item.paymentMethod as string).replace(/^credit_card:xx/i, 'credit_card:');
          await Expense.updateOne({ _id: item._id }, { $set: { paymentMethod: cleanMethod } });
        }
      }
    } catch (e) {
      console.error('Legacy paymentMethod migration error:', e);
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
    const { date, categoryId, amount, note, tags, paymentMethod, isOneOff, oneOffType, aiNote } = body;

    let cleanPaymentMethod = paymentMethod || 'upi';
    if (cleanPaymentMethod.startsWith('credit_card:')) {
      cleanPaymentMethod = cleanPaymentMethod.replace(/^credit_card:xx/i, 'credit_card:');
    }

    if (!date || !categoryId || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    const expense = await Expense.create({ 
      date, 
      categoryId, 
      amount: parsedAmount, 
      note: note ?? '', 
      tags: tags ?? [],
      paymentMethod: cleanPaymentMethod,
      isOneOff: Boolean(isOneOff),
      oneOffType: oneOffType || '',
      aiNote: aiNote ?? '',
    });

    // Check category budget threshold for push alert asynchronously
    (async () => {
      try {
        const Settings = (await import('@/lib/models/Settings')).default;
        const settings = await Settings.findOne({}).lean();
        if (settings && settings.categories) {
          const cat = (settings.categories as any[]).find((c: any) => c.id === categoryId);
          if (cat && cat.monthlyBudget > 0) {
            const ym = date.slice(0, 7);
            const monthExpenses = await Expense.find({
              categoryId,
              date: { $gte: `${ym}-01`, $lte: `${ym}-31` }
            }).select('amount').lean();
            const catTotal = monthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
            const pct = (catTotal / cat.monthlyBudget) * 100;

            if (pct >= 80) {
              const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
              await fetch(`${origin}/api/push/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: pct >= 100 ? `🚨 Budget Exceeded: ${cat.name}` : `⚠️ Budget Warning: ${cat.name}`,
                  body: `Spent ₹${Math.round(catTotal)} of ₹${cat.monthlyBudget} (${Math.round(pct)}%) on ${cat.name}`,
                  url: '/expenses'
                })
              });
            }
          }
        }
      } catch (pushErr) {
        console.warn('Budget push alert error:', pushErr);
      }
    })().catch(() => {});

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('POST /api/expenses error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
