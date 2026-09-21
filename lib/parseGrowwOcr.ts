/**
 * parseGrowwOcr.ts
 * Parses raw OCR text from Groww portfolio screenshots.
 * Detects whether it's a Mutual Fund or Stocks screenshot automatically.
 * Runs 100% on-device — no API key, no network call.
 */

import type { PortfolioType } from './types';

export interface ParsedPortfolio {
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

/** Strip ₹ / commas / + signs and parse to number */
function parseINR(raw: string): number {
  return parseFloat(raw.replace(/[₹,\s+]/g, '').trim()) || 0;
}

/** Find the first rupee amount within a sliding window of lines */
function findAmount(lines: string[], startIdx: number, window = 4): number {
  for (let i = startIdx; i < Math.min(startIdx + window, lines.length); i++) {
    const m = lines[i].match(/[₹]?\s*([\d,]+(?:\.\d+)?)/);
    if (m && parseINR(m[1]) > 10) return parseINR(m[1]);
  }
  return 0;
}

/** Extract percentage like "+13.67%" or "-2.3%" */
function findPercent(text: string): number {
  const m = text.match(/([+\-]?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Detect portfolio type from OCR text.
 * Returns 'mutual_funds', 'stocks', or 'combined'.
 */
export function detectPortfolioType(ocrText: string): PortfolioType {
  const lower = ocrText.toLowerCase();

  // Strong mutual fund indicators
  const mfScore =
    (lower.includes('sip') ? 3 : 0) +
    (lower.includes('nav') ? 3 : 0) +
    (lower.includes('units') ? 2 : 0) +
    (lower.includes('folio') ? 3 : 0) +
    (lower.includes('mutual fund') ? 4 : 0) +
    (lower.includes('scheme') ? 2 : 0) +
    (lower.includes('lumpsum') ? 2 : 0) +
    (lower.includes('redempt') ? 2 : 0) +
    (lower.includes('exit load') ? 3 : 0) +
    (lower.includes('direct') ? 1 : 0) +
    (lower.includes('growth') && lower.includes('fund') ? 2 : 0);

  // Strong stock indicators
  const stockScore =
    (lower.includes('qty') ? 3 : 0) +
    (lower.includes('ltp') ? 3 : 0) +
    (lower.includes('cmp') ? 3 : 0) +
    (lower.includes('shares') ? 2 : 0) +
    (lower.includes('nse') ? 2 : 0) +
    (lower.includes('bse') ? 2 : 0) +
    (lower.includes('equity') && !lower.includes('equity fund') ? 2 : 0) +
    (lower.includes('avg. cost') ? 3 : 0) +
    (lower.includes('market price') ? 2 : 0) +
    (lower.includes('day p&l') ? 3 : 0) +
    (lower.includes('holdings') ? 2 : 0);

  if (mfScore > stockScore + 2) return 'mutual_funds';
  if (stockScore > mfScore + 2) return 'stocks';
  return 'combined';
}

/** Main parser — extracts portfolio numbers from Groww OCR text */
export function parseGrowwOcrText(ocrText: string): ParsedPortfolio {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const portfolioType = detectPortfolioType(ocrText);

  let currentValue = 0;
  let totalInvested = 0;
  let totalGain = 0;
  let gainPercent = 0;

  // ── Strategy 1: keyword-proximity scan ─────────────────────────────
  const currentKeywords  = ['current value', 'current val', 'portfolio value', 'total value', 'market value', 'present value'];
  const investedKeywords = ['invested', 'total invested', 'amount invested', 'principal', 'invested amount'];
  const gainKeywords     = ['total returns', 'overall returns', 'total gain', 'returns', 'p&l', 'gain/loss', 'day p&l', 'overall p&l'];

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();

    if (!currentValue && currentKeywords.some((k) => lower.includes(k))) {
      currentValue = findAmount(lines, i, 4);
    }

    if (!totalInvested && investedKeywords.some((k) => lower.includes(k))) {
      totalInvested = findAmount(lines, i, 4);
    }

    if (gainKeywords.some((k) => lower.includes(k))) {
      const window = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
      // Try to find a signed rupee amount
      const signedMatch = window.match(/([+\-])[₹]?\s*([\d,]+(?:\.\d+)?)/);
      if (signedMatch && !totalGain) {
        const sign = signedMatch[1] === '-' ? -1 : 1;
        totalGain = parseINR(signedMatch[2]) * sign;
      }
      if (!gainPercent) gainPercent = findPercent(window);
    }
  }

  // ── Strategy 2: fallback — grab all ₹ amounts, largest = current ──
  if (!currentValue || !totalInvested) {
    const all: number[] = [];
    const re = /[₹]([\d,]+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(ocrText)) !== null) {
      const v = parseINR(m[1]);
      if (v > 100) all.push(v);
    }
    const unique = [...new Set(all)].sort((a, b) => b - a);
    if (!currentValue && unique.length > 0) currentValue = unique[0];
    if (!totalInvested && unique.length > 1) totalInvested = unique[1];
  }

  // ── Compute derived values ──────────────────────────────────────────
  if (!totalGain && currentValue && totalInvested) {
    totalGain = currentValue - totalInvested;
  }
  if (!gainPercent && totalInvested > 0) {
    gainPercent = Number(((totalGain / totalInvested) * 100).toFixed(2));
  }

  // ── Strategy 3: individual fund/stock rows ─────────────────────────
  const funds: ParsedPortfolio['funds'] = [];

  for (const line of lines) {
    // Pattern: "Name ... ₹X,XXX ... ₹X,XXX"
    const fm = line.match(/^([A-Za-z][\w\s\-&.]+?)\s+[₹]([\d,]+)\s+[₹]([\d,]+)/);
    if (fm) {
      const name = fm[1].trim();
      if (name.length < 2 || name.length > 70) continue;
      const a1 = parseINR(fm[2]);
      const a2 = parseINR(fm[3]);
      if (a1 > 0 && a2 > 0) {
        const fGain = a2 - a1;
        funds.push({
          name,
          invested: a1,
          current: a2,
          gain: fGain,
          gainPercent: a1 > 0 ? Number(((fGain / a1) * 100).toFixed(2)) : 0,
        });
      }
    }
  }

  return { totalInvested, currentValue, totalGain, gainPercent, portfolioType, funds };
}
