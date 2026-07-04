import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Settings from '@/lib/models/Settings';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CATEGORIES = [
  { id: uuidv4(), name: 'Rent', emoji: '🏠', monthlyBudget: 10500, notes: 'Housing', color: '#6366f1' },
  { id: uuidv4(), name: 'Electricity', emoji: '⚡', monthlyBudget: 1000, notes: 'Utilities', color: '#f59e0b' },
  { id: uuidv4(), name: 'Travel', emoji: '🚗', monthlyBudget: 1000, notes: 'Commute & trips', color: '#10b981' },
  { id: uuidv4(), name: 'Groceries', emoji: '🛒', monthlyBudget: 9000, notes: 'Food & supplies', color: '#3b82f6' },
  { id: uuidv4(), name: 'Investment', emoji: '📈', monthlyBudget: 25000, notes: 'SIP / Stocks / FD', color: '#8b5cf6' },
  { id: uuidv4(), name: 'Family', emoji: '👨‍👩‍👧', monthlyBudget: 50000, notes: 'Family expenses', color: '#ec4899' },
  { id: uuidv4(), name: 'Subscriptions', emoji: '📱', monthlyBudget: 1000, notes: 'OTT / Apps', color: '#14b8a6' },
  { id: uuidv4(), name: 'Miscellaneous', emoji: '🎲', monthlyBudget: 5595, notes: 'Unexpected Expense', color: '#f97316' },
];

export async function GET() {
  try {
    await dbConnect();
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        annualSalary: 1574604,
        monthlySalary: 131217,
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
    const { annualSalary, categories } = body;

    const monthlySalary = Math.round(annualSalary / 12);

    const settings = await Settings.findOneAndUpdate(
      {},
      { annualSalary, monthlySalary, categories },
      { new: true, upsert: true }
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
