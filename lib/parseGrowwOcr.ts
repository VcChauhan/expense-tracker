/**
 * parseGrowwOcr.ts
 * Robust parser for Groww Mutual Funds and Stocks screenshots.
 * Supports both:
 * 1. Individual Fund/Stock screens (e.g. SBI ELSS Tax Saver Fund Direct Growth)
 * 2. Overall Portfolio Dashboard screens
 */

import type { PortfolioType } from './types';

export interface ParsedPortfolio {
  holdingName?: string;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
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
  // Strip currency symbols (₹, $, ¥, £), commas, plus signs, spaces
  const cleaned = raw.replace(/[₹$¥£,\s+]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Detect portfolio type from text.
 * Returns 'mutual_funds', 'stocks', or 'combined'.
 */
export function detectPortfolioType(ocrText: string): PortfolioType {
  const lower = ocrText.toLowerCase();

  const mfScore =
    (lower.includes('sip') ? 3 : 0) +
    (lower.includes('nav') ? 4 : 0) +
    (lower.includes('units') ? 3 : 0) +
    (lower.includes('folio') ? 4 : 0) +
    (lower.includes('mutual fund') ? 4 : 0) +
    (lower.includes('elss') ? 4 : 0) +
    (lower.includes('direct growth') ? 4 : 0) +
    (lower.includes('scheme') ? 2 : 0) +
    (lower.includes('tax saver') ? 3 : 0) +
    (lower.includes('lumpsum') ? 2 : 0) +
    (lower.includes('fund') ? 2 : 0);

  const stockScore =
    (lower.includes('qty') ? 4 : 0) +
    (lower.includes('ltp') ? 4 : 0) +
    (lower.includes('cmp') ? 4 : 0) +
    (lower.includes('shares') ? 3 : 0) +
    (lower.includes('nse') ? 3 : 0) +
    (lower.includes('bse') ? 3 : 0) +
    (lower.includes('holdings') ? 3 : 0) +
    (lower.includes('avg. cost') ? 3 : 0) +
    (lower.includes('day p&l') ? 3 : 0);

  if (mfScore >= stockScore && mfScore > 0) return 'mutual_funds';
  if (stockScore > mfScore && stockScore > 0) return 'stocks';
  return 'mutual_funds';
}

/**
 * Extract scheme / stock holding name if this is an individual holding screen
 */
export function extractHoldingName(lines: string[]): string {
  // Ignore system UI lines
  const ignorePatterns = [
    /^\d{1,2}:\d{2}/, // "21:42"
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

    // Check if line looks like a fund or stock name
    const isFundMatch = /(?:Fund|Growth|Direct|ELSS|Index|ETF|Equity|Tax Saver|Bluechip|Cap|Hybrid|Liquid|Debt|Plan)/i.test(line);
    const isStockMatch = /(?:Ltd|Limited|Industries|Bank|Motors|Enterprises|Corp|Steel|Power|Finance)/i.test(line);

    if (isFundMatch || isStockMatch) {
      let name = line.replace(/^[^\w]+|[^\w)]+$/g, '').trim();
      // Check if next line continues the name (e.g. line 1: "SBI ELSS Tax Saver", line 2: "Growth")
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

/** Main parser */
export function parseGrowwOcrText(ocrText: string): ParsedPortfolio {
  const rawLines = ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
  const portfolioType = detectPortfolioType(ocrText);
  const holdingName = extractHoldingName(rawLines);

  let totalInvested = 0;
  let currentValue = 0;
  let totalGain = 0;
  let gainPercent = 0;

  // ── Strategy 1: Look for Groww's 3-column table header ───────────────
  // Groww layouts have:
  // "Invested"    "Current"    "Returns"
  // "₹29,999"     "₹30,365"    "+₹367" (or +1.2%)
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i].toLowerCase();
    const hasInvested = l.includes('invested');
    const hasCurrent = l.includes('current') || l.includes('curr');
    const hasReturns = l.includes('return') || l.includes('p&l');

    // Case A: Headers on same line (e.g. "Invested Current Returns")
    if (hasInvested && (hasCurrent || hasReturns)) {
      // Numbers are usually on the next 1 or 2 lines
      for (let offset = 1; offset <= 3 && i + offset < rawLines.length; offset++) {
        const numLine = rawLines[i + offset];
        const tokens = numLine.match(/[+\-]?[₹$¥£]?[0-9,]+(?:\.[0-9]+)?/g) || [];
        const cleanTokens = tokens
          .map((t) => ({ raw: t, val: cleanNumber(t) }))
          .filter((t) => t.val > 0 || t.raw.includes('+') || t.raw.includes('-'));

        if (cleanTokens.length >= 2) {
          totalInvested = cleanTokens[0].val;
          currentValue = cleanTokens[1].val;
          if (cleanTokens.length >= 3) {
            const isNegative = cleanTokens[2].raw.includes('-');
            totalGain = isNegative ? -Math.abs(cleanTokens[2].val) : Math.abs(cleanTokens[2].val);
          }
          break;
        }
      }
      if (currentValue > 0) break;
    }

    // Case B: Vertically stacked headers & values
    if (!totalInvested && hasInvested) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const m = rawLines[j].match(/[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (m) {
          const v = cleanNumber(m[1]);
          if (v > 100) { totalInvested = v; break; }
        }
      }
    }

    if (!currentValue && (hasCurrent || l.includes('portfolio value') || l.includes('market value'))) {
      for (let j = i; j < Math.min(i + 4, rawLines.length); j++) {
        const m = rawLines[j].match(/[₹$¥£]?\s*([0-9,]+(?:\.[0-9]+)?)/);
        if (m) {
          const v = cleanNumber(m[1]);
          if (v > 100) { currentValue = v; break; }
        }
      }
    }
  }

  // ── Strategy 2: Scan for lines with 2 large numbers ──────────────────
  // E.g. "$29,999 $30,365 +367" or "729,999 30,365"
  if (!currentValue || !totalInvested) {
    for (const line of rawLines) {
      // Match comma-separated numbers of 4+ digits
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

  // ── Strategy 3: Rupee / currency fallback ─────────────────────────────
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

  // ── Compute derived values ───────────────────────────────────────────
  if (!totalGain && currentValue && totalInvested) {
    totalGain = currentValue - totalInvested;
  }
  if (!gainPercent && totalInvested > 0) {
    gainPercent = Number(((totalGain / totalInvested) * 100).toFixed(2));
  }

  return {
    holdingName,
    totalInvested,
    currentValue,
    totalGain,
    gainPercent,
    portfolioType,
    funds: holdingName
      ? [
          {
            name: holdingName,
            invested: totalInvested,
            current: currentValue,
            gain: totalGain,
            gainPercent,
          },
        ]
      : [],
  };
}
