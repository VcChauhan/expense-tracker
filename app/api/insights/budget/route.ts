import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { generateLocalBudgetInsights } from '@/lib/localInsights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mStr = searchParams.get('month');
    const yStr = searchParams.get('year');

    if (!mStr || !yStr) {
      return NextResponse.json({ error: 'Missing month/year' }, { status: 400 });
    }

    const month = parseInt(mStr);
    const year = parseInt(yStr);
    
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=900');

    await connectMongo();

    const monthStr = month.toString().padStart(2, '0');
    const regex = new RegExp(`^${year}-${monthStr}`);

    const [currentExpenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!currentExpenses.length || !settings?.categories?.length) {
      return NextResponse.json({ insights: [] }, { headers });
    }

    const categoriesPayload = settings.categories.map((c: any) => {
      const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
      return {
        id: c.id,
        name: c.name,
        budgetLimit: c.monthlyBudget,
        actualSpent: spent,
      };
    });

    const localInsights = generateLocalBudgetInsights(categoriesPayload);
    return NextResponse.json({ insights: localInsights }, { headers });
  } catch (error: any) {
    console.error('Error generating budget insights:', error);
    return NextResponse.json({ insights: [] });
  }
}
