import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InvestmentSnapshot from '@/lib/models/InvestmentSnapshot';
import Settings from '@/lib/models/Settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    const snapshots = await InvestmentSnapshot.find().sort({ date: -1, createdAt: -1 });
    return NextResponse.json(snapshots);
  } catch (error: any) {
    console.error('GET /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      holdingName = '',
      date,
      totalInvested,
      currentValue,
      totalGain,
      gainPercent,
      oneDayGain = 0,
      oneDayGainPercent = 0,
      source = 'groww',
      portfolioType = 'combined',
      funds = [],
      units = 0,
      buyPrice = 0,
      purchaseTime = '',
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
      holdingName: holdingName.trim(),
      date: date || new Date().toISOString().split('T')[0],
      totalInvested: inv,
      currentValue: cur,
      totalGain: computedGain,
      gainPercent: computedGainPct,
      oneDayGain: Number(oneDayGain) || 0,
      oneDayGainPercent: Number(oneDayGainPercent) || 0,
      source,
      portfolioType,
      funds: Array.isArray(funds) ? funds : [],
      units: Number(units) || 0,
      buyPrice: Number(buyPrice) || 0,
      purchaseTime: purchaseTime || '',
      screenshotUrl,
    });

    // Auto-update Net Worth asset if requested
    if (syncNetWorth && cur > 0) {
      try {
        const settings = await Settings.findOne();
        if (settings) {
          const entries = [...(settings.netWorthEntries || [])];
          const todayStr = new Date().toISOString().split('T')[0];
          const isStocks = portfolioType === 'stocks';
          const isMF = portfolioType === 'mutual_funds';
          const isGold = portfolioType === 'gold';
          const isCombined = portfolioType === 'combined';

          if (isMF || isCombined) {
            let mfIdx = entries.findIndex(
              (e: any) =>
                e.type === 'asset' &&
                (e.category === 'Mutual Funds' ||
                  e.name.toLowerCase().includes('groww mf') ||
                  e.name.toLowerCase().includes('mutual fund'))
            );
            const mfVal = isCombined ? Math.round(cur * 0.6) : cur;
            if (mfIdx >= 0) {
              entries[mfIdx].amount = mfVal;
              entries[mfIdx].lastUpdated = todayStr;
            } else {
              entries.push({
                id: 'nw_mf_' + Date.now(),
                name: 'Mutual Funds (Groww)',
                type: 'asset',
                amount: mfVal,
                category: 'Mutual Funds',
                lastUpdated: todayStr,
              });
            }
          }

          if (isStocks || isCombined) {
            let stockIdx = entries.findIndex(
              (e: any) =>
                e.type === 'asset' &&
                (e.category === 'Stocks & Equity' ||
                  e.name.toLowerCase().includes('groww stock') ||
                  e.name.toLowerCase().includes('stock'))
            );
            const stockVal = isCombined ? Math.round(cur * 0.4) : cur;
            if (stockIdx >= 0) {
              entries[stockIdx].amount = stockVal;
              entries[stockIdx].lastUpdated = todayStr;
            } else {
              entries.push({
                id: 'nw_stock_' + Date.now(),
                name: 'Stocks (Groww)',
                type: 'asset',
                amount: stockVal,
                category: 'Stocks & Equity',
                lastUpdated: todayStr,
              });
            }
          }

          if (isGold) {
            let goldIdx = entries.findIndex(
              (e: any) =>
                e.type === 'asset' &&
                (e.category === 'Gold & Precious Metals' ||
                  e.category === 'Gold' ||
                  e.name.toLowerCase().includes('gold'))
            );
            if (goldIdx >= 0) {
              entries[goldIdx].amount = cur;
              entries[goldIdx].lastUpdated = todayStr;
            } else {
              entries.push({
                id: 'nw_gold_' + Date.now(),
                name: 'Gold Investments',
                type: 'asset',
                amount: cur,
                category: 'Gold & Precious Metals',
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

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const {
      id,
      originalName,
      holdingName,
      totalInvested,
      currentValue,
      portfolioType,
      fundName,
      units,
      buyPrice,
      purchaseTime,
    } = body;

    if (!id && !originalName) {
      return NextResponse.json({ error: 'ID or originalName is required' }, { status: 400 });
    }

    const inv = Number(totalInvested) || 0;
    const cur = Number(currentValue) || 0;
    const gain = cur - inv;
    const gainPct = inv > 0 ? Number(((gain / inv) * 100).toFixed(2)) : 0;
    const newName = (holdingName || '').trim();

    // 1. Update standalone documents matching originalName or id
    const filter = originalName
      ? { holdingName: { $regex: new RegExp(`^${originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      : { _id: id };

    await InvestmentSnapshot.updateMany(filter, {
      $set: {
        holdingName: newName,
        totalInvested: inv,
        currentValue: cur,
        totalGain: gain,
        gainPercent: gainPct,
        ...(portfolioType ? { portfolioType } : {}),
        ...(units !== undefined ? { units: Number(units) || 0 } : {}),
        ...(buyPrice !== undefined ? { buyPrice: Number(buyPrice) || 0 } : {}),
        ...(purchaseTime !== undefined ? { purchaseTime: String(purchaseTime) } : {}),
      },
    });

    // 2. Also update if it lives inside funds[] of any snapshot
    const targetOldName = (fundName || originalName || '').trim();
    if (targetOldName) {
      const snapshotsWithFund = await InvestmentSnapshot.find({ 'funds.name': targetOldName });
      for (const s of snapshotsWithFund) {
        let changed = false;
        (s.funds || []).forEach((f: any) => {
          if (f.name.toLowerCase() === targetOldName.toLowerCase()) {
            f.name = newName || f.name;
            f.invested = inv;
            f.current = cur;
            f.gain = gain;
            f.gainPercent = gainPct;
            if (units !== undefined) f.units = Number(units) || 0;
            if (buyPrice !== undefined) f.buyPrice = Number(buyPrice) || 0;
            changed = true;
          }
        });
        if (changed) {
          await s.save();
        }
      }
    }

    // 3. Auto-update Net Worth
    try {
      const allLatest = await InvestmentSnapshot.find().sort({ date: -1 });
      const totalMF = allLatest
        .filter((s) => s.portfolioType === 'mutual_funds')
        .reduce((sum, s) => sum + (s.currentValue || 0), 0);
      const totalStocks = allLatest
        .filter((s) => s.portfolioType === 'stocks')
        .reduce((sum, s) => sum + (s.currentValue || 0), 0);
      const totalGold = allLatest
        .filter((s) => s.portfolioType === 'gold')
        .reduce((sum, s) => sum + (s.currentValue || 0), 0);

      const settings = await Settings.findOne();
      if (settings && settings.netWorthEntries) {
        const entries = [...settings.netWorthEntries];
        if (totalMF > 0) {
          const idx = entries.findIndex(
            (e: any) => e.type === 'asset' && (e.category === 'Mutual Funds' || e.name.toLowerCase().includes('mutual fund'))
          );
          if (idx >= 0) entries[idx].amount = totalMF;
        }
        if (totalStocks > 0) {
          const idx = entries.findIndex(
            (e: any) => e.type === 'asset' && (e.category === 'Stocks & Equity' || e.name.toLowerCase().includes('stock'))
          );
          if (idx >= 0) entries[idx].amount = totalStocks;
        }
        if (totalGold > 0) {
          const idx = entries.findIndex(
            (e: any) => e.type === 'asset' && (e.category === 'Gold & Precious Metals' || e.category === 'Gold' || e.name.toLowerCase().includes('gold'))
          );
          if (idx >= 0) {
            entries[idx].amount = totalGold;
          } else {
            entries.push({
              id: 'nw_gold_' + Date.now(),
              name: 'Gold Investments',
              type: 'asset',
              amount: totalGold,
              category: 'Gold & Precious Metals',
              lastUpdated: new Date().toISOString().split('T')[0],
            });
          }
        }
        settings.netWorthEntries = entries;
        await settings.save();
      }
    } catch (nwErr) {
      console.error('Net Worth sync error during edit:', nwErr);
    }

    return NextResponse.json({ success: true, message: 'Holding updated successfully' });
  } catch (error: any) {
    console.error('PATCH /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update holding' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const fundName = searchParams.get('fundName');
    const holdingName = searchParams.get('holdingName');

    // 1. Wipe all snapshots if id === 'all'
    if (id === 'all') {
      await InvestmentSnapshot.deleteMany({});
      return NextResponse.json({ success: true, message: 'All snapshots deleted' });
    }

    // 2. Delete by holdingName: removes ALL duplicates/historical snapshots of this holding
    const targetName = (holdingName || fundName || '').trim();
    if (targetName) {
      // Remove any documents where holdingName matches
      await InvestmentSnapshot.deleteMany({
        holdingName: { $regex: new RegExp(`^${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });

      // Also remove from any documents where it exists inside funds[]
      const snapshotsWithFund = await InvestmentSnapshot.find({ 'funds.name': targetName });
      for (const s of snapshotsWithFund) {
        s.funds = (s.funds || []).filter((f) => f.name.toLowerCase() !== targetName.toLowerCase());
        if (s.funds.length === 0 && !s.holdingName) {
          await InvestmentSnapshot.findByIdAndDelete(s._id);
        } else {
          await s.save();
        }
      }
      return NextResponse.json({ success: true });
    }

    // 3. Fallback: delete by MongoDB _id
    if (id && id !== 'undefined' && id !== 'null') {
      let realId = id;
      if (id.includes('_')) {
        const parts = id.split('_');
        realId = parts[0];
      }
      const snap = await InvestmentSnapshot.findById(realId);
      if (snap) {
        if (snap.holdingName) {
          await InvestmentSnapshot.deleteMany({ holdingName: snap.holdingName });
        } else {
          await InvestmentSnapshot.findByIdAndDelete(realId);
        }
      } else {
        await InvestmentSnapshot.findByIdAndDelete(realId);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID or holdingName is required' }, { status: 400 });
  } catch (error: any) {
    console.error('DELETE /api/investments/snapshots error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
