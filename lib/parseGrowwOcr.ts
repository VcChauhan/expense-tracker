/**
 * parseGrowwOcr.ts
 * Parses raw OCR text from a Groww portfolio screenshot.
 * Runs entirely on-device — no network call, no API key needed.
 */

export interface ParsedPortfolio {
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
  funds: {
    name: string;
    invested: number;
    current: number;
    gain: number;
    gainPercent: number;
  }[];
}

/** Strip ₹ / commas and parse a localised INR string to a number */
function parseINR(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[+]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

/** Find the first ₹ amount in a line or the next non-empty line */
function findAmount(lines: string[], startIdx: number, searchWindow = 3): number {
  const rupeeRe = /[₹]?\s*([\d,]+(?:\.\d+)?)/;
  for (let i = startIdx; i < Math.min(startIdx + searchWindow, lines.length); i++) {
    const m = lines[i].match(rupeeRe);
    if (m) return parseINR(m[1]);
  }
  return 0;
}

/** Extract a percentage like "+13.67%" or "-2.3%" */
function findPercent(text: string): number {
  const m = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : 0;
}

export function parseGrowwOcrText(ocrText: string): ParsedPortfolio {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const fullText = ocrText.toLowerCase();

  let currentValue = 0;
  let totalInvested = 0;
  let totalGain = 0;
  let gainPercent = 0;

  // ── Strategy 1: keyword-proximity scanning ──────────────────────────
  const keywords = {
    current: ['current value', 'current val', 'portfolio value', 'total value', 'market value'],
    invested: ['invested', 'total invested', 'amount invested', 'principal'],
    gain: ['total returns', 'overall returns', 'total gain', 'total profit', 'returns', 'p&l', 'gain/loss'],
    percent: ['returns', 'gain%', 'return %'],
  };

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();

    if (!currentValue && keywords.current.some((k) => lower.includes(k))) {
      currentValue = findAmount(lines, i, 4);
    }
    if (!totalInvested && keywords.invested.some((k) => lower.includes(k))) {
      totalInvested = findAmount(lines, i, 4);
    }
    if (!totalGain && keywords.gain.some((k) => lower.includes(k))) {
      // gain line might have both ₹ amount and %
      const combined = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
      // Look for signed amount: +₹33,500 or -₹1,200
      const signedAmt = combined.match(/[+\-]?[₹]?\s*([\d,]+(?:\.\d+)?)/g);
      if (signedAmt && signedAmt.length > 0) {
        const raw = signedAmt[0];
        const isNeg = raw.includes('-');
        totalGain = parseINR(raw) * (isNeg ? -1 : 1);
      }
      gainPercent = findPercent(combined);
    }
  }

  // ── Strategy 2: extract all ₹ amounts & pick by position/size ────────
  // If keyword scan missed values, fall back to finding all rupee amounts
  if (!currentValue || !totalInvested) {
    const allAmounts: number[] = [];
    const rupeeGlobal = /[₹]([\d,]+(?:\.\d+)?)/g;
    let m;
    while ((m = rupeeGlobal.exec(ocrText)) !== null) {
      const v = parseINR(m[1]);
      if (v > 100) allAmounts.push(v); // ignore tiny values
    }

    // Deduplicate and sort desc
    const unique = [...new Set(allAmounts)].sort((a, b) => b - a);

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

  // ── Strategy 3: fund list extraction ─────────────────────────────────
  // Try to find individual fund rows: "Fund Name ... ₹X,XXX ... ₹X,XXX ... +X%"
  const funds: ParsedPortfolio['funds'] = [];
  const fundPattern = /^([A-Za-z][\w\s\-&]+?)\s+(?:[₹]([\d,]+))\s+(?:[₹]([\d,]+))/;

  for (const line of lines) {
    const fm = line.match(fundPattern);
    if (fm) {
      const name = fm[1].trim();
      if (name.length < 3 || name.length > 60) continue;
      const amt1 = parseINR(fm[2]);
      const amt2 = parseINR(fm[3]);
      if (amt1 > 0 && amt2 > 0) {
        const fGain = amt2 - amt1;
        const fPct = amt1 > 0 ? Number(((fGain / amt1) * 100).toFixed(2)) : 0;
        funds.push({
          name,
          invested: amt1,
          current: amt2,
          gain: fGain,
          gainPercent: fPct,
        });
      }
    }
  }

  return {
    totalInvested,
    currentValue,
    totalGain,
    gainPercent,
    funds,
  };
}
