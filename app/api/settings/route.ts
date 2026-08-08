import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/mongodb';
import Settings from '@/lib/models/Settings';
import { computeSalaryBreakdown } from '@/lib/taxUtils';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CATEGORIES = [
  { id: uuidv4(), name: 'Rent',          emoji: '🏠', monthlyBudget: 10500, notes: 'Housing',           color: '#6366f1' },
  { id: uuidv4(), name: 'Electricity',   emoji: '⚡', monthlyBudget: 1000,  notes: 'Utilities',          color: '#f59e0b' },
  { id: uuidv4(), name: 'Travel',        emoji: '🚗', monthlyBudget: 1000,  notes: 'Commute & trips',    color: '#10b981' },
  { id: uuidv4(), name: 'Groceries',     emoji: '🛒', monthlyBudget: 9000,  notes: 'Food & supplies',    color: '#3b82f6' },
  { id: uuidv4(), name: 'Investment',    emoji: '📈', monthlyBudget: 25000, notes: 'SIP / Stocks / FD',  color: '#8b5cf6' },
  { id: uuidv4(), name: 'Family',        emoji: '👨‍👩‍👧', monthlyBudget: 50000, notes: 'Family expenses',    color: '#ec4899' },
  { id: uuidv4(), name: 'Subscriptions', emoji: '📱', monthlyBudget: 1000,  notes: 'OTT / Apps',         color: '#14b8a6' },
  { id: uuidv4(), name: 'Miscellaneous', emoji: '🎲', monthlyBudget: 5595,  notes: 'Unexpected Expense', color: '#f97316' },
];

export async function GET() {
  try {
    await dbConnect();
    let settings = await Settings.findOne();

    if (!settings) {
      const breakdown = computeSalaryBreakdown(1574604, 'new', 50, 0, 0, 0);
      settings = await Settings.create({
        annualSalary: 1574604,
        monthlySalary: breakdown.monthlyInhand,
        taxRegime: 'new',
        basicPercent: 50,
        deductions80C: 0,
        deductions80D: 0,
        otherDeductions: 0,
        epfMonthly: breakdown.epfEmployeeMonthly,
        annualTax: breakdown.annualTax,
        professionalTax: breakdown.professionalTax,
        taxableIncome: breakdown.taxableIncome,
        effectiveTaxRate: breakdown.effectiveTaxRate,
        categories: DEFAULT_CATEGORIES,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      annualSalary,
      taxRegime = 'new',
      basicPercent = 50,
      deductions80C = 0,
      deductions80D = 0,
      otherDeductions = 0,
      categories,
      savingsGoals,
    } = body;

    // Compute in-hand salary with EPF + tax
    const breakdown = computeSalaryBreakdown(
      annualSalary,
      taxRegime,
      basicPercent,
      deductions80C,
      deductions80D,
      otherDeductions,
    );

    const settings = await Settings.findOneAndUpdate(
      {},
      {
        annualSalary,
        monthlySalary: breakdown.monthlyInhand,
        taxRegime,
        basicPercent,
        deductions80C,
        deductions80D,
        otherDeductions,
        epfMonthly: breakdown.epfEmployeeMonthly,
        annualTax: breakdown.annualTax,
        professionalTax: breakdown.professionalTax,
        taxableIncome: breakdown.taxableIncome,
        effectiveTaxRate: breakdown.effectiveTaxRate,
        categories,
        savingsGoals,
      },
      { new: true, upsert: true }
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: body },
      { new: true, upsert: true }
    );
    return NextResponse.json(settings);
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to partial update settings' }, { status: 500 });
  }
}
