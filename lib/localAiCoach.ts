import { Category, Expense, SavingsGoal } from './types';

export interface Rule503020 {
  needsSpent: number;
  needsPct: number;
  wantsSpent: number;
  wantsPct: number;
  savingsRetained: number;
  savingsPct: number;
  status: 'optimal' | 'wants_heavy' | 'needs_heavy' | 'low_savings';
}

export interface FinancialHealthAudit {
  rule503020: Rule503020;
  emergencyRunwayMonths: number;
  wealthVelocityScore: number; // 0 to 100
  weeklyActionCards: { title: string; desc: string; type: 'success' | 'warning' | 'tip' }[];
}

export function auditFinancialHealth(
  salary: number,
  expenses: Expense[],
  categories: Category[],
  savingsGoals: SavingsGoal[] = []
): FinancialHealthAudit {
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const netIncome = Math.max(salary, totalSpent);

  let needsSpent = 0;
  let wantsSpent = 0;

  expenses.forEach(exp => {
    const cat = categories.find(c => c.id === exp.categoryId);
    const catName = cat?.name?.toLowerCase() || '';
    if (catName.includes('rent') || catName.includes('bill') || catName.includes('utility') || catName.includes('grocery') || catName.includes('emi') || catName.includes('tax')) {
      needsSpent += exp.amount;
    } else {
      wantsSpent += exp.amount;
    }
  });

  const savingsRetained = Math.max(0, netIncome - totalSpent);

  const needsPct = netIncome > 0 ? Number(((needsSpent / netIncome) * 100).toFixed(1)) : 0;
  const wantsPct = netIncome > 0 ? Number(((wantsSpent / netIncome) * 100).toFixed(1)) : 0;
  const savingsPct = netIncome > 0 ? Number(((savingsRetained / netIncome) * 100).toFixed(1)) : 0;

  let ruleStatus: Rule503020['status'] = 'optimal';
  if (savingsPct < 20) ruleStatus = 'low_savings';
  else if (wantsPct > 30) ruleStatus = 'wants_heavy';
  else if (needsPct > 50) ruleStatus = 'needs_heavy';

  // Emergency Runway (Months of Needs covered by Savings Goals currentAmount)
  const totalLiquidSaved = savingsGoals.reduce((s, g) => s + g.currentAmount, 0) + savingsRetained;
  const monthlyMandatoryBurn = needsSpent > 0 ? needsSpent : (totalSpent * 0.5);
  const emergencyRunwayMonths = monthlyMandatoryBurn > 0 ? Number((totalLiquidSaved / monthlyMandatoryBurn).toFixed(1)) : 0;

  // Wealth Velocity Score (0 - 100)
  let score = 50;
  if (savingsPct >= 20) score += 25;
  else if (savingsPct >= 10) score += 10;
  if (wantsPct <= 30) score += 15;
  if (emergencyRunwayMonths >= 3) score += 10;
  const wealthVelocityScore = Math.min(100, score);

  // Weekly Action Cards
  const weeklyActionCards: FinancialHealthAudit['weeklyActionCards'] = [];

  if (savingsPct >= 20) {
    weeklyActionCards.push({
      title: '🎯 Savings Target Achieved',
      desc: `Great job! You retained ${savingsPct}% of your income. Consider allocating surplus to your top savings goal.`,
      type: 'success'
    });
  } else {
    weeklyActionCards.push({
      title: '⚠️ Boost Your Savings Velocity',
      desc: `Your current savings rate is ${savingsPct}%. Pushing towards 20% will build your emergency fund faster.`,
      type: 'warning'
    });
  }

  if (wantsPct > 30) {
    weeklyActionCards.push({
      title: '🛒 Discretionary Want Alert',
      desc: `Discretionary spend (dining, shopping, travel) is at ${wantsPct}% (target ≤30%). Try setting a weekly cap on wants.`,
      type: 'warning'
    });
  }

  if (emergencyRunwayMonths < 3) {
    weeklyActionCards.push({
      title: '🛡️ Build Emergency Fund Runway',
      desc: `Your liquid reserves cover ${emergencyRunwayMonths} months of mandatory expenses. Target is at least 3 to 6 months.`,
      type: 'tip'
    });
  } else {
    weeklyActionCards.push({
      title: '🛡️ Strong Emergency Reserve',
      desc: `You have ${emergencyRunwayMonths} months of mandatory expenses covered in your liquid reserves!`,
      type: 'success'
    });
  }

  return {
    rule503020: {
      needsSpent,
      needsPct,
      wantsSpent,
      wantsPct,
      savingsRetained,
      savingsPct,
      status: ruleStatus
    },
    emergencyRunwayMonths,
    wealthVelocityScore,
    weeklyActionCards
  };
}
