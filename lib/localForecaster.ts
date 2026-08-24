import { Category, Expense, formatINR } from './types';

export interface CashflowForecast {
  projectedMonthEndSpent: number;
  projectedSurplus30d: number;
  projectedSurplus60d: number;
  projectedSurplus90d: number;
  weekendBurnRate: number; // Avg spent per weekend day
  weekdayBurnRate: number; // Avg spent per weekday
  recommendedPreBudget: { categoryId: string; name: string; recommendedBudget: number }[];
}

export function predictCashflowAndBudget(
  monthlySalary: number,
  expenses: Expense[],
  categories: Category[],
  historical3MonthAvgTotal: number = 0
): CashflowForecast {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = Math.max(1, now.getDate());

  let weekendTotal = 0;
  let weekendCount = 0;
  let weekdayTotal = 0;
  let weekdayCount = 0;

  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendTotal += exp.amount;
      weekendCount += 1;
    } else {
      weekdayTotal += exp.amount;
      weekdayCount += 1;
    }
  });

  const weekendBurnRate = weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0;
  const weekdayBurnRate = weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0;

  const totalSpentSoFar = expenses.reduce((s, e) => s + e.amount, 0);

  // Time-series forecast using current burn pace + remaining days
  const projectedMonthEndSpent = Math.round((totalSpentSoFar / currentDay) * daysInMonth);

  const monthlySurplusPace = Math.max(0, monthlySalary - projectedMonthEndSpent);

  const projectedSurplus30d = monthlySurplusPace;
  const projectedSurplus60d = monthlySurplusPace * 2;
  const projectedSurplus90d = monthlySurplusPace * 3;

  // Optimized Pre-Budget Generator for Next Month
  const recommendedPreBudget = categories.map(cat => {
    const catSpent = expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0);
    const catPace = currentDay > 0 ? (catSpent / currentDay) * daysInMonth : catSpent;
    
    // Recommend budget based on 70% current pace + 30% original target
    const recommended = Math.round(catPace * 0.7 + (cat.monthlyBudget || 1000) * 0.3);

    return {
      categoryId: cat.id,
      name: cat.name,
      recommendedBudget: Math.max(500, recommended)
    };
  });

  return {
    projectedMonthEndSpent,
    projectedSurplus30d,
    projectedSurplus60d,
    projectedSurplus90d,
    weekendBurnRate,
    weekdayBurnRate,
    recommendedPreBudget
  };
}
