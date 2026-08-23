import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { generateLocalHikeInsights } from '@/lib/localInsights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const yStr = searchParams.get('year');
    const pStr = searchParams.get('hikePercent');

    if (!yStr || !pStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const year = parseInt(yStr);
    const hikePercent = parseFloat(pStr);
    
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, max-age=0');

    await connectMongo();

    const regex = new RegExp(`^${year}-`);
    const [expenses, settings] = await Promise.all([
      Expense.find({ date: { $regex: regex } }),
      Settings.findOne()
    ]);

    if (!settings?.categories?.length) {
      return NextResponse.json({ insights: [] }, { headers });
    }

    const categoriesPayload = settings.categories.map((c: any) => {
      const spent = expenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
      const currentBudgetMonthly = c.monthlyBudget;
      const proposedBudgetMonthly = Math.round(c.monthlyBudget * (1 + hikePercent / 100));
      return {
        name: c.name,
        currentAnnualBudget: currentBudgetMonthly * 12,
        proposedAnnualBudget: proposedBudgetMonthly * 12,
        actualSpentThisYear: spent,
      };
    });

    const localInsights = generateLocalHikeInsights(hikePercent, categoriesPayload);
    return NextResponse.json({ insights: localInsights }, { headers });
  } catch (error: any) {
    console.error('Error generating hike insights:', error);
    return NextResponse.json({ insights: [] });
  }
}
