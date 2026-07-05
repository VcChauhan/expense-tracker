import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import HikeHistory from '@/lib/models/HikeHistory';
import Settings from '@/lib/models/Settings';
import { computeSalaryBreakdown } from '@/lib/taxUtils';

/** GET /api/hike — fetch hike history */
export async function GET() {
  try {
    await dbConnect();
    const history = await HikeHistory.find().sort({ appliedAt: -1 }).limit(20).lean();
    return NextResponse.json(history);
  } catch (error) {
    console.error('GET /api/hike error:', error);
    return NextResponse.json({ error: 'Failed to fetch hike history' }, { status: 500 });
  }
}

/**
 * POST /api/hike — apply a hike:
 * 1. Saves hike record to HikeHistory
 * 2. Updates Settings with new salary + category budgets
 */
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      year,
      hikePercent,
      previousAnnualSalary,
      newAnnualSalary,
      categories, // [{ id, name, emoji, previousBudget, newBudget }]
    } = body;

    // Fetch current settings to get tax regime info
    const currentSettings = await Settings.findOne();
    const taxRegime     = currentSettings?.taxRegime     ?? 'new';
    const basicPercent  = currentSettings?.basicPercent  ?? 50;
    const deductions80C = currentSettings?.deductions80C ?? 0;
    const deductions80D = currentSettings?.deductions80D ?? 0;
    const otherDeds     = currentSettings?.otherDeductions ?? 0;

    // Compute previous & new in-hand salaries
    const prevBreakdown = computeSalaryBreakdown(previousAnnualSalary, taxRegime, basicPercent, deductions80C, deductions80D, otherDeds);
    const newBreakdown  = computeSalaryBreakdown(newAnnualSalary,      taxRegime, basicPercent, deductions80C, deductions80D, otherDeds);

    // Save hike history
    await HikeHistory.create({
      year,
      hikePercent,
      previousAnnualSalary,
      newAnnualSalary,
      previousMonthlyInhand: prevBreakdown.monthlyInhand,
      newMonthlyInhand:       newBreakdown.monthlyInhand,
      categories,
      appliedAt: new Date(),
    });

    // Update Settings: new salary + new category budgets
    const updatedCategoryBudgets = categories.map((c: { id: string; name: string; emoji: string; previousBudget: number; newBudget: number }) => ({
      id: c.id,
      newBudget: c.newBudget,
    }));

    const updatedCategories = (currentSettings?.categories ?? []).map(cat => {
      const updated = updatedCategoryBudgets.find((u: { id: string }) => u.id === cat.id);
      const plain   = { id: cat.id, name: cat.name, emoji: cat.emoji, notes: cat.notes, color: cat.color, monthlyBudget: cat.monthlyBudget };
      return { ...plain, monthlyBudget: updated ? updated.newBudget : cat.monthlyBudget };
    });

    await Settings.findOneAndUpdate(
      {},
      {
        annualSalary:     newAnnualSalary,
        monthlySalary:    newBreakdown.monthlyInhand,
        epfMonthly:       newBreakdown.epfEmployeeMonthly,
        annualTax:        newBreakdown.annualTax,
        professionalTax:  newBreakdown.professionalTax,
        taxableIncome:    newBreakdown.taxableIncome,
        effectiveTaxRate: newBreakdown.effectiveTaxRate,
        categories:       updatedCategories,
      },
      { new: true }
    );

    return NextResponse.json({ success: true, newMonthlyInhand: newBreakdown.monthlyInhand });
  } catch (error) {
    console.error('POST /api/hike error:', error);
    return NextResponse.json({ error: 'Failed to apply hike' }, { status: 500 });
  }
}
