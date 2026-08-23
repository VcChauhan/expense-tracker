export interface Insight {
  type: 'general' | 'savings_coaching' | 'rebalancing' | 'category_drift' | 'hike_advice';
  message: string;
}

export function generateLocalDashboardInsights(payload: any, scope: string = 'monthly'): Insight[] {
  const insights: Insight[] = [];

  if (scope === 'annual') {
    const data = payload.currentYear || {};
    const totalSpent = data.totalSpent || 0;
    const savingsRate = data.savingsRatePercentage || 0;
    const categories = data.categories || [];

    if (savingsRate > 20) {
      insights.push({
        type: 'savings_coaching',
        message: `Outstanding annual discipline! You've saved ${savingsRate}% of your income this year.`
      });
    } else if (savingsRate > 0) {
      insights.push({
        type: 'savings_coaching',
        message: `You have a positive savings rate of ${savingsRate}% this year. Pushing towards 20% will build your emergency fund faster.`
      });
    }

    const overbudget = categories.filter((c: any) => c.annualBudgetLimit > 0 && c.actualSpentThisYear > c.annualBudgetLimit);
    if (overbudget.length > 0) {
      const names = overbudget.map((c: any) => c.name).join(', ');
      insights.push({
        type: 'rebalancing',
        message: `Annual budget watch: ${names} ${overbudget.length === 1 ? 'has' : 'have'} exceeded yearly target limits.`
      });
    } else if (totalSpent > 0) {
      insights.push({
        type: 'general',
        message: `All category budgets are currently within your planned yearly limits!`
      });
    }
  } else {
    const data = payload.currentMonth || {};
    const totalSpent = data.totalSpent || 0;
    const savingsRate = data.savingsRatePercentage || 0;
    const categories = data.categories || [];

    if (savingsRate >= 20) {
      insights.push({
        type: 'savings_coaching',
        message: `Great pace! You've saved ${savingsRate}% of your monthly income so far.`
      });
    } else if (savingsRate > 0) {
      insights.push({
        type: 'savings_coaching',
        message: `You're currently saving ${savingsRate}% of your income this month. Keep an eye on discretionary spending.`
      });
    } else if (totalSpent > 0) {
      insights.push({
        type: 'savings_coaching',
        message: `Warning: Your current spend exceeds your monthly income. Consider checking your top spending categories.`
      });
    }

    // Category check
    const overbudget = categories.filter((c: any) => c.budgetLimit > 0 && c.actualSpent > c.budgetLimit);
    const underbudget = categories.filter((c: any) => c.budgetLimit > 0 && c.actualSpent < c.budgetLimit * 0.7);

    if (overbudget.length > 0 && underbudget.length > 0) {
      const over = overbudget[0];
      const under = underbudget[0];
      const overage = Math.round(over.actualSpent - over.budgetLimit);
      insights.push({
        type: 'rebalancing',
        message: `${over.name} is ₹${overage} over budget. You can rebalance using surplus capacity in ${under.name}.`
      });
    } else if (overbudget.length > 0) {
      const over = overbudget[0];
      const overage = Math.round(over.actualSpent - over.budgetLimit);
      insights.push({
        type: 'rebalancing',
        message: `${over.name} has exceeded its monthly budget cap by ₹${overage}.`
      });
    }

    // Historical comparison
    const drifted = categories.find((c: any) => c.historical3MonthAverage > 0 && c.actualSpent > c.historical3MonthAverage * 1.25);
    if (drifted) {
      insights.push({
        type: 'category_drift',
        message: `${drifted.name} spend (₹${drifted.actualSpent}) is 25% higher than your 3-month historical average (₹${drifted.historical3MonthAverage}).`
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'general',
      message: 'Your spending discipline is steady and all categories are within healthy ranges.'
    });
  }

  return insights;
}

export function generateLocalFullReport(payload: any) {
  const data = payload.currentMonth || {};
  const totalSpent = data.totalSpent || 0;
  const savingsRate = data.savingsRatePercentage || 0;
  const categories = data.categories || [];

  const momComparisons = categories.map((c: any) => {
    const diff = Math.round(c.actualSpent - c.spentLastMonth);
    const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    let analysis = '';

    if (trend === 'up') {
      analysis = `Spent ₹${Math.abs(diff)} more than last month.`;
      if (c.historical3MonthAverage > 0 && c.actualSpent > c.historical3MonthAverage) {
        analysis += ` Also above your 3-month average of ₹${c.historical3MonthAverage}.`;
      }
    } else if (trend === 'down') {
      analysis = `Spent ₹${Math.abs(diff)} less than last month. Excellent control!`;
    } else {
      analysis = `Spending remained steady compared to last month.`;
    }

    return {
      category: c.name,
      trend,
      difference: Math.abs(diff),
      analysis
    };
  });

  const over = categories.find((c: any) => c.budgetLimit > 0 && c.actualSpent > c.budgetLimit);

  const actionableSteps = [
    savingsRate >= 20 ? 'Maintain your current savings momentum by transferring surplus funds to your top savings goal.' : 'Review discretionary spending in high-burn categories to push your savings rate above 20%.',
    over ? `Set a weekly spend cap for ${over.name} to bring it back within budget.` : 'All categories are within budget limits. Keep up the consistent tracking!'
  ];

  return {
    executiveSummary: savingsRate >= 20 
      ? `Great financial health this month! You have saved ${savingsRate}% of your income with ₹${totalSpent} spent total.` 
      : `Your total spending this month is ₹${totalSpent} (savings rate ${savingsRate}%). Review top categories to optimize your budget.`,
    momComparisons,
    actionableSteps
  };
}
