import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { generateLocalDashboardInsights } from '@/lib/localInsights';

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
    
    const headers = new Headers();
    if (scope === 'annual') {
      headers.set('Cache-Control', 'private, max-age=86400');
    } else {
      headers.set('Cache-Control', 'private, max-age=900');
    }

    await connectMongo();
    const settings = await Settings.findOne();

    const monthStr = month.toString().padStart(2, '0');
    
    let currentExpenses: any[] = [];
    let historicalExpenses: any[] = [];

    if (scope === 'annual') {
      const regex = new RegExp(`^${year}-`);
      currentExpenses = await Expense.find({ date: { $regex: regex } });
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
      const daysElapsed = new Date().getDate();
      const totalDays = new Date(year, month, 0).getDate();
      const projectedMonthEndSpend = daysElapsed > 0 ? (totalSpent / daysElapsed) * totalDays : totalSpent;

      const histCatMap = new Map<string, number>();
      for (const exp of historicalExpenses) {
        histCatMap.set(exp.categoryId, (histCatMap.get(exp.categoryId) || 0) + exp.amount);
      }

      const categoriesPayload = (settings?.categories || []).map((c: any) => {
        const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
        const histTotal = histCatMap.get(c.id) || 0;
        return {
          name: c.name,
          budgetLimit: c.monthlyBudget,
          actualSpent: spent,
          historical3MonthAverage: Math.round(histTotal / 3)
        };
      });

      payload = {
        currentMonth: {
          monthId: `${year}-${monthStr}`,
          daysElapsed,
          totalDays,
          totalSpent,
          projectedMonthEndSpend: Math.round(projectedMonthEndSpend),
          savingsRatePercentage: Number(savingsRatePercentage.toFixed(1)),
          categories: categoriesPayload
        }
      };
    }

    const localInsights = generateLocalDashboardInsights(payload, scope);
    return NextResponse.json({ insights: localInsights }, { headers });
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ insights: [{ type: "general", message: "Your spending and category budgets are currently steady!" }] });
  }
}
