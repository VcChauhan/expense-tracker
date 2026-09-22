/**
 * parseGrowwOcr.ts
 * Robust parser for Groww Mutual Funds and Stocks screenshots.
 * Supports both:
 * 1. Single Fund/Stock screen (e.g. SBI ELSS Tax Saver Fund Direct Growth)
 * 2. Full Dashboard screen (e.g. Investments (5) or Holdings (2) with all funds/stocks)
 */

import type { PortfolioType } from './types';

export interface ParsedPortfolio {
  holdingName?: string;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
  oneDayGain?: number;
  oneDayGainPercent?: number;
  portfolioType: PortfolioType;
  units?: number;
  buyPrice?: number;
  funds: {
    name: string;
    invested: number;
    current: number;
    gain: number;
    gainPercent: number;
    units?: number;
    buyPrice?: number;
  }[];
}

/** Clean and parse a numeric string into a float */
function cleanNumber(raw: string): number {
  const cleaned = raw.replace(/[%₹$¥£,\s+]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

/** Detect portfolio type from text */
export function detectPortfolioType(ocrText: string): PortfolioType {
  const lower = ocrText.toLowerCase();

  const mfScore =
    (lower.includes('mutual fund') ? 5 : 0) +
    (lower.includes('sip') ? 3 : 0) +
    (lower.includes('nav') ? 4 : 0) +
    (lower.includes('units') ? 3 : 0) +
    (lower.includes('folio') ? 4 : 0) +
    (lower.includes('elss') ? 4 : 0) +
    (lower.includes('direct growth') ? 4 : 0) +
    (lower.includes('scheme') ? 2 : 0) +
    (lower.includes('tax saver') ? 3 : 0) +
    (lower.includes('fund') ? 3 : 0);

  const stockScore =
    (lower.includes('stocks') && !lower.includes('mutual fund') ? 4 : 0) +
    (lower.includes('holdings (') ? 4 : 0) +
    (lower.includes('qty') ? 4 : 0) +
    (lower.includes('ltp') ? 4 : 0) +
    (lower.includes('cmp') ? 4 : 0) +
    (lower.includes('shares') ? 3 : 0) +
    (lower.includes('market price') ? 3 : 0) +
    (lower.includes('company') ? 3 : 0);

  if (stockScore > mfScore && stockScore > 0) return 'stocks';
  return 'mutual_funds';
}

/** Check if the screen is a dashboard table with multiple holdings vs a single holding screen */
export function isDashboardScreen(lines: string[]): boolean {
  const hasDashboardHeader = lines.some((l) =>
    /investments\s*\(\d+\)|holdings\s*\(\d+\)|mutual\s*funds\s*\(\d+\)/i.test(l)
  );

  const hasSingleHoldingSignals = lines.some((l) =>
    /folio\s*(?:no\.?|number)?|current\s*nav|avg\s*nav|balanced\s*units|redeem|invest\s*more/i.test(l) ||
    /\b\d{7,12}\b/.test(l)
  );

  if (hasSingleHoldingSignals && !hasDashboardHeader) {
    return false;
  }
  return hasDashboardHeader;
}

/** Extract scheme or stock name from an individual holding screen */
export function extractHoldingName(lines: string[]): string {
  if (isDashboardScreen(lines)) {
    return '';
  }

  const ignorePatterns = [
    /^\d{1,2}:\d{2}/,
    /unselect/i,
    /transaction history/i,
    /portfolio/i,
    /invested/i,
    /current/i,
    /returns/i,
    /nav/i,
    /folio/i,
    /units/i,
    /redeem/i,
    /invest more/i,
    /completed/i,
    /ransaction/i,
  ];

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].trim();
    if (line.length < 3) continue;
    if (ignorePatterns.some((p) => p.test(line))) continue;
    if (/^\d+/.test(line)) continue;

    const isFundMatch = /(?:Fund|Growth|Direct|ELSS|Index|ETF|Equity|Tax Saver|Bluechip|Cap|Hybrid|Liquid|Debt|Plan)/i.test(line);
    const isStockMatch = /(?:Ltd|Limited|Industries|Bank|Motors|Enterprises|Corp|Steel|Power|Finance)/i.test(line);

    if (isFundMatch || isStockMatch) {
      let name = line.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine.length > 0 &&
          nextLine.length < 35 &&
          /^(?:Growth|Direct|Regular|IDCW|Plan|Fund|Limited|Ltd)/i.test(nextLine) &&
          !ignorePatterns.some((p) => p.test(nextLine))
        ) {
          name += ' ' + nextLine.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
        }
      }
      return name;
    }
  }

  return '';
}

/** Extract multiple fund/stock items if this is a dashboard table */
export function extractDashboardFunds(lines: string[]): ParsedPortfolio['funds'] {
  if (!isDashboardScreen(lines)) {
    return [];
  }

  const funds: ParsedPortfolio['funds'] = [];
  const knownFundWords = /(?:Fund|Growth|Plan|Cap|ELSS|Index|ETF|Bank|Gold|Tata|Hdfc|Sbi|Reliance|Infosys|Aditya Birla|Parag Parikh)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (knownFundWords.test(line) && line.length > 5 && line.length < 80) {
      if (/^(?:Fund name|Company|Investments|Holdings)/i.test(line)) continue;

      let name = line.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
      if (i + 1 < lines.length && /^(?:Growth|Direct|Regular|Plan)/i.test(lines[i + 1])) {
        name += ' ' + lines[i + 1].trim();
      }

      let current = 0;
      let invested = 0;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nums = lines[j].match(/[0-9,]+(?:\.[0-9]+)?/g);
        if (nums && nums.length >= 2) {
          const v1 = cleanNumber(nums[0]);
          const v2 = cleanNumber(nums[1]);
          if (v1 > 100 && v2 > 100) {
            current = v1;
            invested = v2;
            break;
          }
        }
      }

      const gain = current - invested;
      const gainPercent = invested > 0 ? Number(((gain / invested) * 100).toFixed(2)) : 0;

      funds.push({
        name,
        invested,
        current,
        gain,
        gainPercent,
      });
    }
  }

  return funds;
}

/** Main parser */
export function parseGrowwOcrText(ocrText: string): ParsedPortfolio {
  const rawLines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
  const portfolioType = detectPortfolioType(ocrText);
  const isDashboard = isDashboardScreen(rawLines);
  const holdingName = extractHoldingName(rawLines);
  const dashboardFunds = extractDashboardFunds(rawLines);

  let totalInvested = 0;
  let currentValue = 0;
  let totalGain = 0;
  let gainPercent = 0;
  let oneDayGain = 0;
  let oneDayGainPercent = 0;
  let units = 0;
  let buyPrice = 0;

  // 1. Isolate summary section (strip out TRANSACTION HISTORY so past transactions don't pollute totals)
  let summaryEndIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i].toLowerCase();
    if (
      l.includes('transaction history') ||
      l.includes('ransaction history') ||
      l.includes('transactions') ||
      l.includes('redeem') ||
      l.includes('invest more') ||
      /^(?:invest\s+\d|completed)/i.test(l)
    ) {
      summaryEndIdx = i;
      break;
    }
  }
  const summaryLines = summaryEndIdx !== -1 ? rawLines.slice(0, summaryEndIdx) : rawLines;

  // 2. Identify 7-12 digit Folio numbers to blacklist from amounts
  const folioBlacklist = new Set<string>();
  summaryLines.forEach((l) => {
    (l.match(/\b\d{7,12}\b/g) || []).forEach((f) => folioBlacklist.add(f));
  });

  // 3. Extract Units & NAV
  for (const l of summaryLines) {
    if (Array.from(folioBlacklist).some((f) => l.includes(f))) {
      // e.g. "\ 458.52 49251872" -> 458.52 is Current Nav
      const decMatch = l.match(/\b\d+\.\d{1,4}\b/);
      if (decMatch) {
        buyPrice = parseFloat(decMatch[0]);
      }
    } else {
      const decs = (l.match(/\b\d+\.\d{1,4}\b/g) || []).map(Number);
      if (decs.length >= 2) {
        // e.g. "452.99 66.224" -> 452.99 is Avg Nav, 66.224 is Balanced Units
        if (!buyPrice) buyPrice = decs[0];
        units = decs[1];
      } else if (decs.length === 1 && decs[0] < 500 && !units) {
        units = decs[0];
      }
    }
  }

  // 4. Strategy 1: Mathematical consistency check (Invested + Returns ~= Current)
  for (const line of summaryLines) {
    if (/^\d{1,2}:\d{2}/.test(line)) continue; // ignore time headers
    if (Array.from(folioBlacklist).some((f) => line.includes(f))) continue;

    const rawTokens = line.match(/[+\-]?[%₹$¥£]?[0-9,]+(?:\.[0-9]+)?/g) || [];
    const cleanTokens = rawTokens
      .map((t) => {
        const isNegative = t.includes('-');
        const clean = t.replace(/[+\-%₹$¥£,\s]/g, '');
        const val = parseFloat(clean) || 0;
        return { raw: t, val, isNegative };
      })
      .filter((t) => t.val >= 100 && !folioBlacklist.has(t.val.toString()));

    if (cleanTokens.length >= 2) {
      let n1 = cleanTokens[0].val;
      let n2 = cleanTokens[1].val;
      let n3 = cleanTokens[2] ? cleanTokens[2].val : n2 - n1;

      // Fix ₹ symbol read as 3 in return (e.g. +3367 -> 367)
      if (n3 > 1000 && Math.abs(n2 - n1) < 1000) {
        const stripped = n3 % 1000;
        if (Math.abs(Math.abs(n2 - n1) - stripped) <= 15) {
          n3 = cleanTokens[2]?.isNegative ? -stripped : stripped;
        }
      }

      // Check mathematical equality: n1 + n3 ~= n2
      if (Math.abs(n1 + n3 - n2) <= 15) {
        totalInvested = n1;
        currentValue = n2;
        totalGain = n3;
        break;
      }
    }
  }

  // 5. Strategy 2: Label-based matching if mathematical check didn't trigger
  if (!currentValue || !totalInvested) {
    for (let i = 0; i < summaryLines.length; i++) {
      const l = summaryLines[i].toLowerCase();

      if (!currentValue && (l.includes('current value') || l === 'current')) {
        for (let j = i; j < Math.min(i + 4, summaryLines.length); j++) {
          if (/folio|nav|units/i.test(summaryLines[j])) continue;
          const m = summaryLines[j].match(/[%₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
          if (m) {
            const v = cleanNumber(m[1]);
            if (v >= 100 && !folioBlacklist.has(v.toString())) {
              currentValue = v;
              break;
            }
          }
        }
      }

      if (!totalInvested && (l.includes('invested value') || l === 'invested')) {
        for (let j = i; j < Math.min(i + 4, summaryLines.length); j++) {
          if (/folio|nav|units/i.test(summaryLines[j])) continue;
          const m = summaryLines[j].match(/[%₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
          if (m) {
            const v = cleanNumber(m[1]);
            if (v >= 100 && !folioBlacklist.has(v.toString())) {
              totalInvested = v;
              break;
            }
          }
        }
      }
    }
  }

  // 6. Strategy 3: Multi-number summary row fallback
  if (!currentValue || !totalInvested) {
    for (const line of summaryLines) {
      if (/folio/i.test(line) || Array.from(folioBlacklist).some((f) => line.includes(f))) continue;

      const tokens = line.match(/[+\-]?[%₹$¥£]?[0-9,]+(?:\.[0-9]+)?/g) || [];
      const validTokens = tokens
        .map((t) => {
          const isNegative = t.includes('-');
          const clean = t.replace(/[+\-%₹$¥£,\s]/g, '');
          const val = parseFloat(clean) || 0;
          return { raw: t, val, isNegative };
        })
        .filter((t) => t.val >= 100 && !folioBlacklist.has(t.val.toString()));

      if (validTokens.length >= 2) {
        let n1 = validTokens[0].val;
        let n2 = validTokens[1].val;
        let n3 = validTokens[2] ? validTokens[2].val : n2 - n1;

        totalInvested = n1;
        currentValue = n2;
        if (!totalGain) totalGain = n3;
        break;
      }
    }
  }

  // 7. Compute derived returns
  if (!totalGain && currentValue && totalInvested) {
    totalGain = currentValue - totalInvested;
  }
  if (!gainPercent && totalInvested > 0) {
    gainPercent = Number(((totalGain / totalInvested) * 100).toFixed(2));
  }

  // Build funds array: if dashboard, return dashboardFunds; if single holding, return 1 clean fund item
  let funds: ParsedPortfolio['funds'] = [];
  if (isDashboard && dashboardFunds.length > 0) {
    funds = dashboardFunds;
  } else if (holdingName || currentValue > 0) {
    funds = [
      {
        name: holdingName || (portfolioType === 'stocks' ? 'Stock Holding' : 'Mutual Fund Scheme'),
        invested: totalInvested,
        current: currentValue,
        gain: totalGain,
        gainPercent,
        units: units || undefined,
        buyPrice: buyPrice || undefined,
      },
    ];
  }

  return {
    holdingName,
    totalInvested,
    currentValue,
    totalGain,
    gainPercent,
    oneDayGain,
    oneDayGainPercent,
    portfolioType,
    units: units || undefined,
    buyPrice: buyPrice || undefined,
    funds,
  };
}
