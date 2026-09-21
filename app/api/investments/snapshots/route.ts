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
      funds: Array.isArray(funds) ? funds : [],
      screenshotUrl,
    });

    // Optionally sync latest portfolio value into Net Worth "Mutual Funds" / "Groww" asset
    if (syncNetWorth && cur > 0) {
      try {
        const settings = await Settings.findOne();
        if (settings) {
          const entries = [...(settings.netWorthEntries || [])];
          const mfIndex = entries.findIndex(
            (e) =>
              e.type === 'asset' &&
              (e.category === 'Mutual Funds' ||
                e.name.toLowerCase().includes('mutual fund') ||
                e.name.toLowerCase().includes('groww'))
          );

          const todayStr = new Date().toISOString().split('T')[0];
          if (mfIndex >= 0) {
            entries[mfIndex].amount = cur;
            entries[mfIndex].lastUpdated = todayStr;
          } else {
            entries.push({
              id: 'nw_mf_' + Date.now(),
              name: 'Mutual Funds (Groww)',
              type: 'asset',
              amount: cur,
              category: 'Mutual Funds',
              lastUpdated: todayStr,
            });
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
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    await InvestmentSnapshot.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete snapshot' }, { status: 500 });
  }
}
