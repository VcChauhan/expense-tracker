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
  funds: {
    name: string;
    invested: number;
    current: number;
    gain: number;
    gainPercent: number;
  }[];
}

/** Clean and parse a numeric string into a float */
function cleanNumber(raw: string): number {
  const cleaned = raw.replace(/[₹$¥£,\s+]/g, '').trim();
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

/** Extract scheme or stock name from an individual holding screen */
export function extractHoldingName(lines: string[]): string {
  const isDashboard = lines.some((l) => /investments\s*\(\d+\)|holdings\s*\(\d+\)/i.test(l));
  if (isDashboard) {
    // It is a dashboard containing multiple holdings, not a single holding
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
  ];

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].trim();
    if (line.length < 3) continue;
    if (ignorePatterns.some((p) => p.test(line))) continue;

    const isFundMatch = /(?:Fund|Growth|Direct|ELSS|Index|ETF|Equity|Tax Saver|Bluechip|Cap|Hybrid|Liquid|Debt|Plan)/i.test(line);
    const isStockMatch = /(?:Ltd|Limited|Industries|Bank|Motors|Enterprises|Corp|Steel|Power|Finance)/i.test(line);

    if (isFundMatch || isStockMatch) {
      let name = line.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine.length > 0 &&
          nextLine.length < 30 &&
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
  const funds: ParsedPortfolio['funds'] = [];
  const knownFundWords = /(?:Fund|Growth|Plan|Cap|ELSS|Index|ETF|Bank|Gold|Tata|Hdfc|Sbi|Reliance|Infosys|Aditya Birla|Parag Parikh)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (knownFundWords.test(line) && line.length > 5 && line.length < 80) {
      // Don't match header lines
      if (/^(?:Fund name|Company|Investments|Holdings)/i.test(line)) continue;

      let name = line.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
      // Check if next line continues the name (e.g. "Growth")
      if (i + 1 < lines.length && /^(?:Growth|Direct|Regular|Plan)/i.test(lines[i + 1])) {
        name += ' ' + lines[i + 1].trim();
      }

      // Check next 1-4 lines for numbers (Current and Invested amounts)
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
  const holdingName = extractHoldingName(rawLines);
  const dashboardFunds = extractDashboardFunds(rawLines);

  let totalInvested = 0;
  let currentValue = 0;
  let totalGain = 0;
  let gainPercent = 0;
  let oneDayGain = 0;
  let oneDayGainPercent = 0;

  // ── Strategy 1: Look for Groww's summary header (Current value, Invested value) ──
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i].toLowerCase();

    // Matching "Current value" or "Current"
    if (!currentValue && (l.includes('current value') || l === 'current')) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const m = rawLines[j].match(/[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (m) {
          const v = cleanNumber(m[1]);
          if (v > 100) { currentValue = v; break; }
        }
      }
    }

    // Matching "Invested value" or "Invested"
    if (!totalInvested && (l.includes('invested value') || l === 'invested')) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const m = rawLines[j].match(/[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (m) {
          const v = cleanNumber(m[1]);
          if (v > 100) { totalInvested = v; break; }
        }
      }
    }

    // Matching "1D returns"
    if (l.includes('1d return') || l.includes('1d')) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const pctMatch = rawLines[j].match(/([+\-]?\d+(?:\.\d+)?)\s*%/);
        if (pctMatch && !oneDayGainPercent) {
          oneDayGainPercent = parseFloat(pctMatch[1]);
        }
        const signedAmt = rawLines[j].match(/([+\-])[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (signedAmt && !oneDayGain) {
          const sign = signedAmt[1] === '-' ? -1 : 1;
          oneDayGain = cleanNumber(signedAmt[2]) * sign;
        }
      }
    }

    // Matching "Total returns"
    if (l.includes('total return') || (l.includes('returns') && !l.includes('1d'))) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const pctMatch = rawLines[j].match(/([+\-]?\d+(?:\.\d+)?)\s*%/);
        if (pctMatch && !gainPercent) {
          gainPercent = parseFloat(pctMatch[1]);
        }
        const signedAmt = rawLines[j].match(/([+\-])[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (signedAmt && !totalGain) {
          const sign = signedAmt[1] === '-' ? -1 : 1;
          totalGain = cleanNumber(signedAmt[2]) * sign;
        }
      }
    }

    // 3-Column horizontal table: "Invested Current Returns"
    if (l.includes('invested') && (l.includes('current') || l.includes('return'))) {
      for (let offset = 1; offset <= 3 && i + offset < rawLines.length; offset++) {
        const numLine = rawLines[i + offset];
        const tokens = numLine.match(/[+\-]?[₹$¥£]?[0-9,]+(?:\.[0-9]+)?/g) || [];
        const cleanTokens = tokens
          .map((t) => ({ raw: t, val: cleanNumber(t) }))
          .filter((t) => t.val > 0 || t.raw.includes('+') || t.raw.includes('-'));

        if (cleanTokens.length >= 2) {
          if (!totalInvested) totalInvested = cleanTokens[0].val;
          if (!currentValue) currentValue = cleanTokens[1].val;
          if (cleanTokens.length >= 3 && !totalGain) {
            const isNegative = cleanTokens[2].raw.includes('-');
            totalGain = isNegative ? -Math.abs(cleanTokens[2].val) : Math.abs(cleanTokens[2].val);
          }
          break;
        }
      }
    }
  }

  // ── Strategy 2: Fallback — 2 large numbers on a line ─────────────────
  if (!currentValue || !totalInvested) {
    for (const line of rawLines) {
      const matches = line.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g);
      if (matches && matches.length >= 2) {
        const num1 = cleanNumber(matches[0]);
        const num2 = cleanNumber(matches[1]);
        if (num1 > 100 && num2 > 100) {
          if (!totalInvested) totalInvested = num1;
          if (!currentValue) currentValue = num2;
          break;
        }
      }
    }
  }

  // ── Strategy 3: Currency matches ──────────────────────────────────────
  if (!currentValue || !totalInvested) {
    const allNums: number[] = [];
    const re = /(?:[₹$¥£]|rs\.?)\s*([0-9,]+(?:\.[0-9]+)?)/gi;
    let m;
    while ((m = re.exec(ocrText)) !== null) {
      const v = cleanNumber(m[1]);
      if (v >= 500) allNums.push(v);
    }
    const unique = [...new Set(allNums)].sort((a, b) => b - a);
    if (!currentValue && unique.length > 0) currentValue = unique[0];
    if (!totalInvested && unique.length > 1) totalInvested = unique[1];
  }

  // ── Compute derived values ────────────────────────────────────────────
  if (!totalGain && currentValue && totalInvested) {
    totalGain = currentValue - totalInvested;
  }
  if (!gainPercent && totalInvested > 0) {
    gainPercent = Number(((totalGain / totalInvested) * 100).toFixed(2));
  }

  // Build funds array
  let funds: ParsedPortfolio['funds'] = [];
  if (dashboardFunds.length > 0) {
    funds = dashboardFunds;
  } else if (holdingName) {
    funds = [
      {
        name: holdingName,
        invested: totalInvested,
        current: currentValue,
        gain: totalGain,
        gainPercent,
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
    funds,
  };
}
