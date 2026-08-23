import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import { generateLocalFullReport } from '@/lib/localInsights';

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
      const prevMonthCatMap = new Map<string, number>();
      
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
      const prevMonthPrefix = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
      let prevTotalSpent = 0;

      for (const exp of historicalExpenses) {
        histCatMap.set(exp.categoryId, (histCatMap.get(exp.categoryId) || 0) + exp.amount);
        if (exp.date.startsWith(prevMonthPrefix)) {
          prevMonthCatMap.set(exp.categoryId, (prevMonthCatMap.get(exp.categoryId) || 0) + exp.amount);
          prevTotalSpent += exp.amount;
        }
      }

      const categoriesPayload = (settings?.categories || []).map((c: any) => {
        const spent = currentExpenses.filter(e => e.categoryId === c.id).reduce((sum, e) => sum + e.amount, 0);
        const histTotal = histCatMap.get(c.id) || 0;
        const prevTotal = prevMonthCatMap.get(c.id) || 0;
        return {
          name: c.name,
          budgetLimit: c.monthlyBudget,
          actualSpent: spent,
          spentLastMonth: prevTotal,
          historical3MonthAverage: Math.round(histTotal / 3)
        };
      });

      payload = {
        currentMonth: {
          monthId: `${year}-${monthStr}`,
          daysElapsed,
          totalDays,
          totalSpent,
          prevMonthTotalSpent: prevTotalSpent,
          projectedMonthEndSpend: Math.round(projectedMonthEndSpend),
          savingsRatePercentage: Number(savingsRatePercentage.toFixed(1)),
          categories: categoriesPayload
        }
      };
    }

    const localReport = generateLocalFullReport(payload);
    return NextResponse.json({ report: localReport, rawData: payload }, { headers });
  } catch (error: any) {
    console.error('Error generating full insights:', error);
    return NextResponse.json({ report: generateLocalFullReport({}) }, { headers });
  }
}
