import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InvestmentSnapshot from '@/lib/models/InvestmentSnapshot';
import Settings from '@/lib/models/Settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // 45s timeout for fetching market prices

// Clean query string for mfapi.in search
function getMfSearchQuery(name: string): string {
  // Strip extraneous keywords that hinder search
  return name
    .replace(/(?:Direct|Regular|Plan|Growth|Option|IDCW|Dividend|Fund|Scheme)/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
}

// Map common stock holding names to NSE tickers
const STOCK_TICKER_MAP: Record<string, string> = {
  goldbees: 'GOLDBEES.NS',
  'gold bees': 'GOLDBEES.NS',
  'nippon india etf gold bees': 'GOLDBEES.NS',
  'nippon gold bees': 'GOLDBEES.NS',
  tatagold: 'TATAGOLD.NS',
  'tata gold': 'TATAGOLD.NS',
  'hdfc gold': 'HDFCGOLD.NS',
  hdfcgold: 'HDFCGOLD.NS',
  'sbi gold': 'SBIGOLD.NS',
  sbigold: 'SBIGOLD.NS',
  'hdfc bank': 'HDFCBANK.NS',
  hdfcbank: 'HDFCBANK.NS',
  reliance: 'RELIANCE.NS',
  infy: 'INFY.NS',
  infosys: 'INFY.NS',
  tcs: 'TCS.NS',
  itc: 'ITC.NS',
  sbi: 'SBIN.NS',
  sbin: 'SBIN.NS',
  wipro: 'WIPRO.NS',
  tatamotors: 'TATAMOTORS.NS',
  'tata motors': 'TATAMOTORS.NS',
};

async function getLiveGoldRate(): Promise<{ ratePerGram: number; goldBeesPrice: number; prevClose: number }> {
  let ratePerGram = 0;
  let goldBeesPrice = 0;
  let prevClose = 0;

  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GOLDBEES.NS?interval=1d&range=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      goldBeesPrice = meta?.regularMarketPrice || 0;
      prevClose = meta?.chartPreviousClose || goldBeesPrice;
    }
  } catch (e) {
    console.warn('Failed to fetch GOLDBEES:', e);
  }

  try {
    const [gcRes, inrRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 },
      }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 },
      }),
    ]);
    if (gcRes.ok && inrRes.ok) {
      const gcData = await gcRes.json();
      const inrData = await inrRes.json();
      const gcPrice = gcData.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
      const usdInr = inrData.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
      if (gcPrice > 0 && usdInr > 0) {
        const spotPerGram = (gcPrice * usdInr) / 31.1034768;
        ratePerGram = Math.round(spotPerGram * 1.03); // ~3% GST domestic spot proxy
      }
    }
  } catch (e) {
    console.warn('Failed to fetch GC=F gold rate:', e);
  }

  if (ratePerGram === 0 && goldBeesPrice > 0) {
    ratePerGram = Math.round(goldBeesPrice * 70);
  }
  if (ratePerGram === 0) {
    ratePerGram = 13800; // fallback base rate
  }

  return { ratePerGram, goldBeesPrice, prevClose };
}

export async function GET() {
  try {
    const gold = await getLiveGoldRate();
    return NextResponse.json({ success: true, gold });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch live rates' }, { status: 500 });
  }
}

export async function POST() {
  try {
    await dbConnect();
    const snapshots = await InvestmentSnapshot.find().sort({ date: -1, createdAt: -1 });

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings to update', updated: 0 });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let updatedCount = 0;
    const results: any[] = [];

    // Group distinct latest holdings
    const processedHoldings = new Set<string>();

    for (const snap of snapshots) {
      const holdingName = snap.holdingName?.trim();
      const isStock = snap.portfolioType === 'stocks';
      const isGold = snap.portfolioType === 'gold';

      // ── Process Single Holding ─────────────────────────────────────────
      if (holdingName && !processedHoldings.has(holdingName.toLowerCase())) {
        processedHoldings.add(holdingName.toLowerCase());

        try {
          if (isGold) {
            // Fetch live gold rate (ETF & physical per gram)
            const { ratePerGram, goldBeesPrice, prevClose } = await getLiveGoldRate();
            const lowerName = holdingName.toLowerCase();
            const isEtf = lowerName.includes('bees') || lowerName.includes('etf');

            let newCurrent = snap.currentValue;
            let oneDay = 0;
            let oneDayPct = 0;

            if (isEtf && goldBeesPrice > 0) {
              const qty = (snap.units && snap.units > 0)
                ? snap.units
                : (prevClose > 0 ? Math.round(snap.currentValue / prevClose) : Math.round(snap.currentValue / goldBeesPrice));
              newCurrent = Math.round(qty * goldBeesPrice);
              oneDay = Math.round(qty * (goldBeesPrice - prevClose));
              oneDayPct = prevClose > 0 ? Number((((goldBeesPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;
            } else if (ratePerGram > 0) {
              const grams = (snap.units && snap.units > 0)
                ? snap.units
                : ((snap.buyPrice && snap.buyPrice > 0)
                    ? snap.totalInvested / snap.buyPrice
                    : snap.currentValue / ratePerGram);
              newCurrent = Math.round(grams * ratePerGram);
              const dailyChangePct = (prevClose > 0 && goldBeesPrice > 0)
                ? ((goldBeesPrice - prevClose) / prevClose)
                : 0.002;
              oneDay = Math.round(newCurrent * dailyChangePct);
              oneDayPct = Number((dailyChangePct * 100).toFixed(2));
            }

            const newGain = newCurrent - snap.totalInvested;
            const newPct = snap.totalInvested > 0 ? Number(((newGain / snap.totalInvested) * 100).toFixed(2)) : 0;

            snap.currentValue = newCurrent;
            snap.totalGain = newGain;
            snap.gainPercent = newPct;
            snap.oneDayGain = oneDay;
            snap.oneDayGainPercent = oneDayPct;
            snap.date = todayStr;
            await snap.save();

            updatedCount++;
            results.push({ name: holdingName, type: 'gold', current: newCurrent, ratePerGram, oneDay, oneDayPct });
          } else if (isStock) {
            // Fetch Stock Price from Yahoo Finance
            const cleanKey = holdingName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const ticker =
              STOCK_TICKER_MAP[cleanKey] ||
              STOCK_TICKER_MAP[holdingName.toLowerCase()] ||
              `${cleanKey.toUpperCase()}.NS`;

            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              next: { revalidate: 60 },
            });

            if (res.ok) {
              const data = await res.json();
              const meta = data.chart?.result?.[0]?.meta;
              const price = meta?.regularMarketPrice;
              const prevClose = meta?.chartPreviousClose || price;

              if (price && price > 0) {
                // Estimate quantity if not exact
                const qty = (snap.units && snap.units > 0) ? snap.units : Math.max(1, Math.round(snap.currentValue / prevClose));
                const newCurrent = Math.round(qty * price);
                const newGain = newCurrent - snap.totalInvested;
                const newPct = snap.totalInvested > 0 ? Number(((newGain / snap.totalInvested) * 100).toFixed(2)) : 0;
                const oneDay = Math.round(qty * (price - prevClose));
                const oneDayPct = prevClose > 0 ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;

                snap.currentValue = newCurrent;
                snap.totalGain = newGain;
                snap.gainPercent = newPct;
                snap.oneDayGain = oneDay;
                snap.oneDayGainPercent = oneDayPct;
                snap.date = todayStr;
                await snap.save();

                updatedCount++;
                results.push({ name: holdingName, type: 'stock', price, oneDay, oneDayPct });
              }
            }
          } else {
            // Fetch Mutual Fund NAV from api.mfapi.in
            const searchQ = getMfSearchQuery(holdingName);
            const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchQ)}`, {
              next: { revalidate: 300 },
            });

            if (searchRes.ok) {
              const list = await searchRes.json();
              if (Array.isArray(list) && list.length > 0) {
                // Prefer Direct Plan Growth
                const match =
                  list.find(
                    (x: any) =>
                      x.schemeName.toLowerCase().includes('direct') &&
                      x.schemeName.toLowerCase().includes('growth')
                  ) || list[0];

                const navRes = await fetch(`https://api.mfapi.in/mf/${match.schemeCode}`, {
                  next: { revalidate: 300 },
                });

                if (navRes.ok) {
                  const navData = await navRes.json();
                  const history = navData.data || [];
                  if (history.length > 0) {
                    const latestNav = parseFloat(history[0].nav);
                    const prevNav = history.length > 1 ? parseFloat(history[1].nav) : latestNav;

                    if (latestNav > 0) {
                      // Units = current / latestNav (or invested / avgNav)
                      const units = (snap.units && snap.units > 0) ? snap.units : (snap.currentValue > 0 ? snap.currentValue / prevNav : snap.totalInvested / latestNav);
                      const newCurrent = Math.round(units * latestNav);
                      const newGain = newCurrent - snap.totalInvested;
                      const newPct = snap.totalInvested > 0 ? Number(((newGain / snap.totalInvested) * 100).toFixed(2)) : 0;
                      const oneDay = Math.round(units * (latestNav - prevNav));
                      const oneDayPct = prevNav > 0 ? Number((((latestNav - prevNav) / prevNav) * 100).toFixed(2)) : 0;

                      snap.currentValue = newCurrent;
                      snap.totalGain = newGain;
                      snap.gainPercent = newPct;
                      snap.oneDayGain = oneDay;
                      snap.oneDayGainPercent = oneDayPct;
                      snap.date = todayStr;
                      await snap.save();

                      updatedCount++;
                      results.push({ name: holdingName, type: 'mf', nav: latestNav, oneDay, oneDayPct });
                    }
                  }
                }
              }
            }
          }
        } catch (itemErr) {
          console.warn(`Could not update holding ${holdingName}:`, itemErr);
        }
      }

      // ── Process Multi-Fund Array inside Snapshot ───────────────────────
      if (Array.isArray(snap.funds) && snap.funds.length > 0) {
        let fundsChanged = false;
        let runningTotalCurrent = 0;
        let runningTotalGain = 0;

        for (const f of snap.funds) {
          try {
            const searchQ = getMfSearchQuery(f.name);
            const searchRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchQ)}`, {
              next: { revalidate: 300 },
            });

            if (searchRes.ok) {
              const list = await searchRes.json();
              if (Array.isArray(list) && list.length > 0) {
                const match =
                  list.find(
                    (x: any) =>
                      x.schemeName.toLowerCase().includes('direct') &&
                      x.schemeName.toLowerCase().includes('growth')
                  ) || list[0];

                const navRes = await fetch(`https://api.mfapi.in/mf/${match.schemeCode}`);
                if (navRes.ok) {
                  const navData = await navRes.json();
                  const history = navData.data || [];
                  if (history.length > 0) {
                    const latestNav = parseFloat(history[0].nav);
                    const prevNav = history.length > 1 ? parseFloat(history[1].nav) : latestNav;

                    if (latestNav > 0) {
                      const units = f.current > 0 ? f.current / prevNav : f.invested / latestNav;
                      f.current = Math.round(units * latestNav);
                      f.gain = f.current - f.invested;
                      f.gainPercent = f.invested > 0 ? Number(((f.gain / f.invested) * 100).toFixed(2)) : 0;
                      fundsChanged = true;
                    }
                  }
                }
              }
            }
          } catch (fErr) {
            console.warn(`Could not update sub-fund ${f.name}:`, fErr);
          }
          runningTotalCurrent += f.current || 0;
          runningTotalGain += f.gain || 0;
        }

        if (fundsChanged) {
          snap.currentValue = runningTotalCurrent;
          snap.totalGain = runningTotalGain;
          snap.gainPercent =
            snap.totalInvested > 0 ? Number(((runningTotalGain / snap.totalInvested) * 100).toFixed(2)) : 0;
          snap.date = todayStr;
          await snap.save();
          updatedCount++;
        }
      }
    }

    // ── Auto-sync Net Worth ──────────────────────────────────────────────
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
              lastUpdated: todayStr,
            });
          }
        }

        settings.netWorthEntries = entries;
        await settings.save();
      }
    } catch (nwErr) {
      console.error('Net Worth sync error during live update:', nwErr);
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      results,
      message: `Successfully refreshed live market prices for ${updatedCount} holding(s)!`,
    });
  } catch (error: any) {
    console.error('POST /api/investments/sync-live error:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync live prices' }, { status: 500 });
  }
}
