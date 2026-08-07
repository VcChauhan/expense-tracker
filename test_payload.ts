import mongoose from 'mongoose';
import connectMongo from './lib/mongodb';
import Expense from './lib/models/Expense';
import Settings from './lib/models/Settings';

async function test() {
  await connectMongo();
  const year = 2026;
  const month = 8;
  const monthStr = month.toString().padStart(2, '0');
  
  const regex = new RegExp(`^${year}-${monthStr}`);
  let m3 = month - 3;
  let y3 = year;
  if (m3 <= 0) { m3 += 12; y3 -= 1; }
  const m3Str = m3.toString().padStart(2, '0');
  const threeMonthsAgoPrefix = `${y3}-${m3Str}`;

  const [currentExpenses, historicalExpenses] = await Promise.all([
    Expense.find({ date: { $regex: regex } }),
    Expense.find({ date: { $gte: threeMonthsAgoPrefix, $lt: `${year}-${monthStr}` } })
  ]);
  
  console.log("Current expenses:", currentExpenses.length);
  console.log("Historical expenses:", historicalExpenses.length);
  
  const settings = await Settings.findOne();
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
  
  console.log(JSON.stringify(categoriesPayload, null, 2));
  process.exit(0);
}

test();
