import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';

/**
 * GET /api/merchant-memory?merchant=vijetha
 *
 * Queries the real Expense collection by the stored `merchant` field to return
 * historical context for a given merchant. This is separate from the user's `note`
 * (e.g. merchant="Vijeta Supermarket", note="banana") so lookups still work even
 * after the user has personalised their notes.
 *
 * Used by the Android companion to inject few-shot examples into Gemma's prompt:
 *   "Last 3 times at Vijeta: ₹12 banana, ₹15 banana, ₹18 banana — food/groceries"
 *   → Gemma confidently suggests banana/food/groceries without being explicitly told.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.AUTH_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const merchant = searchParams.get('merchant')?.trim();

  if (!merchant || merchant.length < 2) {
    return NextResponse.json({ found: false, merchant: '', occurrences: 0 });
  }

  try {
    await connectMongo();

    // Extract significant words from the merchant name for fuzzy matching.
    // "VIJETHASUPERMARKETSP" → split by camelCase / caps runs → ["vijetha", "supermarket"]
    // "Vijeta Supermarket" → ["vijeta", "supermarket"]
    const words = merchant
      .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase split
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(/[\s_\-]+/)
      .filter(w => w.length >= 4);            // only meaningful words

    if (words.length === 0) {
      return NextResponse.json({ found: false, merchant, occurrences: 0 });
    }

    // Search by merchant field with fuzzy word matching
    const regexPattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const merchantRegex = new RegExp(regexPattern, 'i');

    const matches = await Expense.find(
      {
        $or: [
          { merchant: { $regex: merchantRegex } },
          // Fallback: also search note field for older expenses saved before merchant field existed
          { note: { $regex: merchantRegex }, merchant: { $exists: false } },
        ]
      },
      { note: 1, merchant: 1, amount: 1, categoryId: 1, tags: 1, date: 1 }
    )
      .sort({ date: -1 })
      .limit(20)
      .lean();

    if (matches.length === 0) {
      return NextResponse.json({ found: false, merchant, occurrences: 0 });
    }

    // Aggregate most common note, category, and tags across all matches
    const noteFreq: Record<string, number> = {};
    const catFreq: Record<string, number> = {};
    const tagFreq: Record<string, number> = {};
    let totalAmount = 0;
    let minAmount = Infinity;
    let maxAmount = -Infinity;

    for (const e of matches) {
      const note = (e.note || '').trim();
      if (note) noteFreq[note] = (noteFreq[note] || 0) + 1;
      if (e.categoryId) catFreq[e.categoryId] = (catFreq[e.categoryId] || 0) + 1;
      for (const tag of (e.tags || [])) tagFreq[tag] = (tagFreq[tag] || 0) + 1;
      totalAmount += e.amount;
      if (e.amount < minAmount) minAmount = e.amount;
      if (e.amount > maxAmount) maxAmount = e.amount;
    }

    const topNote = Object.entries(noteFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const topCategoryId = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';
    const topTags = Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    // Return the 5 most recent examples for Gemma's few-shot context
    const recentExamples = matches.slice(0, 5).map(e => ({
      note: e.note,
      amount: e.amount,
      date: e.date,
      categoryId: e.categoryId,
      tags: e.tags || [],
    }));

    return NextResponse.json({
      found: true,
      merchant,
      topNote,
      topCategoryId,
      topTags,
      avgAmount: Math.round((totalAmount / matches.length) * 100) / 100,
      minAmount: minAmount === Infinity ? 0 : minAmount,
      maxAmount: maxAmount === -Infinity ? 0 : maxAmount,
      occurrences: matches.length,
      recentExamples,
    });

  } catch (error) {
    console.error('merchant-memory error:', error);
    return NextResponse.json({ found: false, merchant, occurrences: 0 });
  }
}
