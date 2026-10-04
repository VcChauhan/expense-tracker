export interface Insight {
  type: 'general' | 'savings_coaching' | 'rebalancing' | 'category_drift' | 'hike_advice';
  message: string;
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
