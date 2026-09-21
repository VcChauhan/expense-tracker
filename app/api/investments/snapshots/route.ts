import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/mongodb';
import InvestmentSnapshot from '@/lib/models/InvestmentSnapshot';
import Settings from '@/lib/models/Settings';

export async function GET() {
  try {
    await dbConnect();
    const snapshots = await InvestmentSnapshot.find().sort({ date: -1, createdAt: -1 }).lean();
    return NextResponse.json(snapshots);
  } catch (error: any) {
    console.error('GET /api/investments/snapshots error:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      date,
      totalInvested,
      currentValue,
      totalGain,
      gainPercent,
      source = 'groww',
      portfolioType = 'combined',
      funds = [],
      screenshotUrl = '',
      syncNetWorth = true,
    } = body;

    const inv = Number(totalInvested) || 0;
    const cur = Number(currentValue) || 0;
    const computedGain = totalGain !== undefined ? Number(totalGain) : cur - inv;
    const computedGainPct =
      gainPercent !== undefined
        ? Number(gainPercent)
        : inv > 0
        ? Number(((computedGain / inv) * 100).toFixed(2))
        : 0;

    const snapshot = await InvestmentSnapshot.create({
      date: date || new Date().toISOString().split('T')[0],
      totalInvested: inv,
      currentValue: cur,
      totalGain: computedGain,
      gainPercent: computedGainPct,
      source,
      portfolioType,
      funds: Array.isArray(funds) ? funds : [],
      screenshotUrl,
    });

    // ── Sync to Net Worth: MF or Stocks asset separately ────────────
    if (syncNetWorth && cur > 0) {
      try {
        const settings = await Settings.findOne();
        if (settings) {
          const entries = [...(settings.netWorthEntries || [])];
          const todayStr = new Date().toISOString().split('T')[0];

          // Determine which Net Worth category to update
          const isMF = portfolioType === 'mutual_funds';
          const isStock = portfolioType === 'stocks';
          const isCombined = portfolioType === 'combined';

          if (isMF || isCombined) {
            // Update/create "Mutual Funds" asset
            const mfIdx = entries.findIndex(
              (e) =>
                e.type === 'asset' &&
                (e.category === 'Mutual Funds' ||
                  e.name.toLowerCase().includes('mutual fund') ||
                  e.name.toLowerCase().includes('groww mf'))
            );
            if (mfIdx >= 0) {
              entries[mfIdx].amount = isCombined ? Math.round(cur * 0.6) : cur;
              entries[mfIdx].lastUpdated = todayStr;
            } else {
              entries.push({
                id: 'nw_mf_' + Date.now(),
                name: 'Mutual Funds (Groww)',
                type: 'asset',
                amount: isCombined ? Math.round(cur * 0.6) : cur,
                category: 'Mutual Funds',
                lastUpdated: todayStr,
              });
            }
          }

          if (isStock || isCombined) {
            // Update/create "Stocks & Equity" asset
            const stockIdx = entries.findIndex(
              (e) =>
                e.type === 'asset' &&
                (e.category === 'Stocks & Equity' ||
                  e.name.toLowerCase().includes('stock') ||
                  e.name.toLowerCase().includes('equity') ||
                  e.name.toLowerCase().includes('groww stock'))
            );
            if (stockIdx >= 0) {
              entries[stockIdx].amount = isCombined ? Math.round(cur * 0.4) : cur;
              entries[stockIdx].lastUpdated = todayStr;
            } else {
              entries.push({
                id: 'nw_stock_' + Date.now(),
                name: 'Stocks (Groww)',
                type: 'asset',
                amount: isCombined ? Math.round(cur * 0.4) : cur,
                category: 'Stocks & Equity',
                lastUpdated: todayStr,
              });
            }
          }

          settings.netWorthEntries = entries;
          await settings.save();
        }
      } catch (syncErr) {
        console.error('Failed to sync investment to Net Worth:', syncErr);
      }
    }

    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error('POST /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save snapshot' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await InvestmentSnapshot.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
