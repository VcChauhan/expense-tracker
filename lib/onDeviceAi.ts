/**
 * On-Device AI Financial Intelligence Engine
 * 
 * Guarantees 100% Client-Side Privacy:
 * - Direct integration with Chrome's experimental Prompt API (Gemini Nano / window.ai)
 * - Deterministic, rule-based financial normalization engine fallback
 * - Zero telemetry, zero external cloud network requests.
 */

import { Category, Expense, OneOffType } from './types';

export interface AnomalyItem {
  id: string;
  name: string;
  amount: number;
  categoryName: string;
  categoryEmoji: string;
  categoryId: string;
  oneOffType: OneOffType | string;
  aiNote?: string;
  date: string;
  amortizedMonthly: number;
}

export interface BudgetNormalizationResult {
  hasGeminiNano: boolean;
  modelEngineName: string;
  totalSpent: number;
  totalAnomalySpent: number;
  normalizedSpent: number;
  anomalies: AnomalyItem[];
  overBudgetBeforeNormalization: {
    categoryName: string;
    emoji: string;
    budget: number;
    actualSpent: number;
    overage: number;
    normalizedSpent: number;
    isNormalizedSafe: boolean;
  }[];
  executiveBriefing: string;
  healthStatus: 'reassuring' | 'watch_recurring' | 'balanced';
  monthContextNote?: string;
}

export const ONE_OFF_TYPES: { type: OneOffType; label: string; icon: string; defaultAmortizeMonths: number }[] = [
  { type: 'annual',    label: 'Annual Plan',    icon: '📅', defaultAmortizeMonths: 12 },
  { type: 'festival',  label: 'Festival / Diwali', icon: '🪔', defaultAmortizeMonths: 6 },
  { type: 'travel',    label: 'Travel / Flights', icon: '✈️', defaultAmortizeMonths: 3 },
  { type: 'medical',   label: 'Medical / Health', icon: '🏥', defaultAmortizeMonths: 6 },
  { type: 'emergency', label: 'Emergency',      icon: '🚨', defaultAmortizeMonths: 6 },
  { type: 'other',     label: 'One-Off / Outlier', icon: '⚡', defaultAmortizeMonths: 1 },
];

/**
 * Check if Chrome's window.ai (Gemini Nano) Prompt API is available in this browser session.
 */
export async function detectOnDeviceAiCapabilities(): Promise<{ available: boolean; status: string }> {
  if (typeof window === 'undefined') return { available: false, status: 'server' };

  try {
    const ai = (window as any).ai;
    if (ai && ai.languageModel) {
      const capabilities = await ai.languageModel.capabilities();
      if (capabilities.available === 'readily' || capabilities.available === 'after-download') {
        return { available: true, status: capabilities.available };
      }
    }
  } catch (err) {
    // Window.ai not supported or flag disabled
  }

  return { available: false, status: 'unavailable' };
}

/**
 * Perform on-device financial normalization & budget reconciliation.
 */
export async function runOnDeviceAnomalyAudit(
  expenses: Expense[],
  categories: Category[],
  monthContextNote: string = '',
  selectedMonthName: string = 'Current Month'
): Promise<BudgetNormalizationResult> {
  const anomalies: AnomalyItem[] = [];
  let totalAnomalySpent = 0;
  let totalSpent = 0;

  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const categorySpendMap = new Map<string, number>();
  const categoryAnomalyMap = new Map<string, number>();

  for (const exp of expenses) {
    const amt = exp.amount || 0;
    totalSpent += amt;

    const cat = categoryMap.get(exp.categoryId);
    const catId = exp.categoryId;
    categorySpendMap.set(catId, (categorySpendMap.get(catId) || 0) + amt);

    // Identify anomalies: explicitly marked isOneOff, or matching high-confidence heuristics
    const isExplicitOneOff = Boolean(exp.isOneOff);
    const noteLower = (exp.note || '').toLowerCase();
    const tagMatch = (exp.tags || []).some(t => ['annual', 'yearly', 'recharge', 'diwali', 'festival', 'flight', 'hospital'].includes(t.toLowerCase()));
    const heuristicOneOff = !isExplicitOneOff && (
      noteLower.includes('annual recharge') ||
      noteLower.includes('365 day') ||
      noteLower.includes('diwali travel') ||
      noteLower.includes('flight ticket') ||
      noteLower.includes('term insurance') ||
      noteLower.includes('health insurance')
    );

    if (isExplicitOneOff || heuristicOneOff) {
      const type: OneOffType = (exp.oneOffType as OneOffType) || (noteLower.includes('annual') || noteLower.includes('recharge') ? 'annual' : noteLower.includes('diwali') ? 'festival' : 'other');
      const amortizeMonths = type === 'annual' ? 12 : type === 'festival' ? 6 : type === 'travel' ? 3 : 1;
      
      anomalies.push({
        id: exp._id,
        name: exp.note || (cat?.name ? `${cat.name} One-Off` : 'Outlier Spend'),
        amount: amt,
        categoryName: cat?.name || 'Uncategorized',
        categoryEmoji: cat?.emoji || '⚡',
        categoryId: catId,
        oneOffType: type,
        aiNote: exp.aiNote || exp.note,
        date: exp.date,
        amortizedMonthly: Math.round(amt / amortizeMonths),
      });

      totalAnomalySpent += amt;
      categoryAnomalyMap.set(catId, (categoryAnomalyMap.get(catId) || 0) + amt);
    }
  }

  const normalizedSpent = Math.max(0, totalSpent - totalAnomalySpent);

  // Compute category-level impact
  const overBudgetBeforeNormalization: BudgetNormalizationResult['overBudgetBeforeNormalization'] = [];

  for (const cat of categories) {
    const rawSpent = categorySpendMap.get(cat.id) || 0;
    const catAnomaly = categoryAnomalyMap.get(cat.id) || 0;
    const normSpent = Math.max(0, rawSpent - catAnomaly);

    if (cat.monthlyBudget > 0 && rawSpent > cat.monthlyBudget) {
      overBudgetBeforeNormalization.push({
        categoryName: cat.name,
        emoji: cat.emoji,
        budget: cat.monthlyBudget,
        actualSpent: rawSpent,
        overage: rawSpent - cat.monthlyBudget,
        normalizedSpent: normSpent,
        isNormalizedSafe: normSpent <= cat.monthlyBudget,
      });
    }
  }

  // Determine health status
  const normalizedSafeCount = overBudgetBeforeNormalization.filter(c => c.isNormalizedSafe).length;
  let healthStatus: BudgetNormalizationResult['healthStatus'] = 'balanced';
  if (overBudgetBeforeNormalization.length > 0 && normalizedSafeCount === overBudgetBeforeNormalization.length) {
    healthStatus = 'reassuring';
  } else if (overBudgetBeforeNormalization.some(c => !c.isNormalizedSafe)) {
    healthStatus = 'watch_recurring';
  }

  // Generate briefing: Try Gemini Nano (window.ai) if available, otherwise deterministic synthesis
  let executiveBriefing = '';
  let modelEngineName = 'Local On-Device Reasoning Engine';
  let hasGeminiNano = false;

  const aiCheck = await detectOnDeviceAiCapabilities();
  if (aiCheck.available && typeof window !== 'undefined') {
    try {
      const ai = (window as any).ai;
      const session = await ai.languageModel.create({
        systemPrompt: 'You are a supportive, calm on-device personal financial advisor. Analyze one-off expenses vs true recurring lifestyle burn without judging. Keep your briefing concise (2-3 sentences), warm, and encouraging. Return plain text only.',
      });

      const promptData = `
Month: ${selectedMonthName}
Total spent: ₹${totalSpent}
Normalized recurring spend: ₹${normalizedSpent}
Excluded one-off anomalies (total ₹${totalAnomalySpent}): ${anomalies.map(a => `${a.name}: ₹${a.amount} (${a.oneOffType})`).join(', ')}
Categories exceeded only because of anomalies: ${overBudgetBeforeNormalization.filter(c => c.isNormalizedSafe).map(c => c.categoryName).join(', ') || 'None'}
Month Context Note from user: "${monthContextNote || 'None'}"

Please explain why the user does NOT need to panic about their category budget overages, highlighting how their true recurring burn is healthy once the non-recurring items are excluded.
`;

      executiveBriefing = await session.prompt(promptData);
      modelEngineName = 'On-Device Gemini Nano';
      hasGeminiNano = true;
      session.destroy?.();
    } catch (e) {
      console.warn('Gemini Nano prompt failed or interrupted, falling back to local reasoning:', e);
    }
  }

  // Fallback deterministic local synthesis if window.ai is not running
  if (!executiveBriefing) {
    if (anomalies.length > 0) {
      const topAnomalyNames = anomalies.slice(0, 2).map(a => `${a.name} (₹${a.amount.toLocaleString('en-IN')})`).join(' and ');
      const reconciledCats = overBudgetBeforeNormalization.filter(c => c.isNormalizedSafe).map(c => c.categoryName);

      if (reconciledCats.length > 0) {
        executiveBriefing = `No need to worry: your ${reconciledCats.join(' & ')} budget overage is entirely driven by one-off expenses (${topAnomalyNames}). Stripping these out, your true recurring monthly burn is ₹${normalizedSpent.toLocaleString('en-IN')}, which remains within your healthy targets.`;
      } else {
        executiveBriefing = `Your spending included ₹${totalAnomalySpent.toLocaleString('en-IN')} in seasonal/annual outlays (${topAnomalyNames}). When normalized, your ongoing baseline burn is ₹${normalizedSpent.toLocaleString('en-IN')}.`;
      }

      if (monthContextNote) {
        executiveBriefing += ` Context noted: "${monthContextNote}".`;
      }
    } else {
      if (overBudgetBeforeNormalization.length > 0) {
        const topOverage = overBudgetBeforeNormalization[0];
        executiveBriefing = `${topOverage.categoryName} is ₹${topOverage.overage.toLocaleString('en-IN')} over budget with no one-off anomalies tagged. If any portion of this was an annual recharge or one-time expense, tag it as an anomaly to normalize your budget!`;
      } else {
        executiveBriefing = `All monthly categories are running cleanly within their limits. Your recurring lifestyle burn is balanced and healthy.`;
      }
    }
  }

  return {
    hasGeminiNano,
    modelEngineName,
    totalSpent,
    totalAnomalySpent,
    normalizedSpent,
    anomalies,
    overBudgetBeforeNormalization,
    executiveBriefing,
    healthStatus,
    monthContextNote,
  };
}

/**
 * Real-Time NLP Note-to-Category & Anomaly Auto-Predictor
 * Runs on-device with zero delay as the user types a note in QuickAddSheet.
 */
export interface NotePredictionResult {
  categoryId?: string;
  tags?: string[];
  isOneOff?: boolean;
  oneOffType?: OneOffType;
  aiNote?: string;
  confidence: number;
}

export function predictFromNote(note: string, categories: Category[]): NotePredictionResult | null {
  if (!note || note.trim().length < 2) return null;
  const lower = note.toLowerCase().trim();

  // 1. Detect Anomaly cues
  let isOneOff = false;
  let oneOffType: OneOffType | undefined = undefined;
  let aiNote: string | undefined = undefined;

  if (lower.includes('annual') || lower.includes('365 day') || lower.includes('yearly') || lower.includes('1 year')) {
    isOneOff = true;
    oneOffType = 'annual';
    aiNote = 'Annual Subscription / Plan';
  } else if (lower.includes('diwali') || lower.includes('festival') || lower.includes('puja') || lower.includes('eid') || lower.includes('holi') || lower.includes('rakhi')) {
    isOneOff = true;
    oneOffType = 'festival';
    aiNote = 'Festival / Seasonal Expense';
  } else if (lower.includes('flight') || lower.includes('ticket') || lower.includes('hotel') || lower.includes('trip') || lower.includes('vacation')) {
    isOneOff = true;
    oneOffType = 'travel';
    aiNote = 'Travel / Flight Booking';
  } else if (lower.includes('hospital') || lower.includes('doctor') || lower.includes('surgery') || lower.includes('medic') || lower.includes('insurance')) {
    isOneOff = true;
    oneOffType = 'medical';
    aiNote = 'Medical / Health Outlay';
  }

  // 2. Map Keywords to Category and Tags
  const categoryKeywords: Record<string, { catKeywords: string[]; tags: string[] }> = {
    'groceries': {
      catKeywords: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'grocery', 'vegetables', 'fruits', 'milk', 'bread', 'supermarket', 'dmart'],
      tags: ['groceries', 'home'],
    },
    'food': {
      catKeywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'chai', 'tea', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger', 'snack'],
      tags: ['dining', 'food'],
    },
    'travel': {
      catKeywords: ['uber', 'ola', 'rapido', 'metro', 'petrol', 'diesel', 'fuel', 'cab', 'auto', 'toll', 'flight', 'railway', 'train', 'irctc'],
      tags: ['commute', 'travel'],
    },
    'electricity': {
      catKeywords: ['electricity', 'power bill', 'bescom', 'tneb', 'bses', 'current bill', 'mseb'],
      tags: ['utility', 'electricity'],
    },
    'subscriptions': {
      catKeywords: ['netflix', 'spotify', 'hotstar', 'prime', 'youtube', 'apple', 'icloud', 'google one', 'chatgpt', 'gym', 'membership'],
      tags: ['subscription', 'digital'],
    },
    'rent': {
      catKeywords: ['rent', 'maintenance', 'landlord', 'flat rent', 'society'],
      tags: ['housing', 'rent'],
    },
    'investment': {
      catKeywords: ['sip', 'groww', 'zerodha', 'mutual fund', 'stocks', 'gold', 'mmtc', 'bullion', 'index fund', 'etf'],
      tags: ['investment', 'wealth'],
    },
    'family': {
      catKeywords: ['mom', 'dad', 'home sent', 'family', 'parents', 'sister', 'brother', 'school fee'],
      tags: ['family'],
    },
  };

  let matchedCategory: Category | undefined = undefined;
  let matchedTags: string[] = [];

  for (const [key, config] of Object.entries(categoryKeywords)) {
    if (config.catKeywords.some(kw => lower.includes(kw))) {
      // Find matching category from user's categories
      matchedCategory = categories.find(c => {
        const cLower = c.name.toLowerCase();
        return cLower.includes(key) || (key === 'food' && (cLower.includes('dining') || cLower.includes('food') || cLower.includes('groceries')));
      });
      matchedTags = config.tags;
      break;
    }
  }

  // Fallback direct name matching
  if (!matchedCategory) {
    matchedCategory = categories.find(c => lower.includes(c.name.toLowerCase()));
  }

  if (matchedCategory || isOneOff) {
    return {
      categoryId: matchedCategory?.id,
      tags: matchedTags.length > 0 ? matchedTags : undefined,
      isOneOff,
      oneOffType,
      aiNote,
      confidence: matchedCategory ? 0.9 : 0.6,
    };
  }

  return null;
}

/**
 * Smart Credit Card Optimizer & Utilization Sentry
 * Evaluates user's credit cards on-device to pick the card with max free credit days
 * and checks if the charge breaches the 30% healthy utilization limit.
 */
export interface CreditCardRecommendation {
  recommendedCard: any;
  freeDaysRemaining: number;
  currentUtilizationPct: number;
  projectedUtilizationPct: number;
  isOverLimitRisk: boolean;
  reason: string;
}

export function evaluateOptimalCreditCard(
  amount: number,
  creditCards: any[] = [],
  expenses: Expense[] = []
): CreditCardRecommendation | null {
  if (!creditCards || creditCards.length === 0) return null;

  const today = new Date();
  const curDate = today.getDate();
  const curYear = today.getFullYear();
  const curMonth = today.getMonth();

  let bestCard: any = null;
  let maxFreeDays = -1;
  let bestUtilization = 0;
  let bestProjected = 0;
  let bestRisk = false;
  let bestReason = '';

  for (const card of creditCards) {
    const limit = card.limit || 100000;
    const billingDay = card.billingDay || 15;
    const paymentDueDays = card.paymentDueDays || 20;

    // Calculate free days remaining from today until payment due date
    let daysUntilBill = billingDay - curDate;
    if (daysUntilBill <= 0) {
      // Today is past the bill day: expense falls into NEXT cycle! (Max benefit)
      const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
      daysUntilBill = (daysInCurMonth - curDate) + billingDay;
    }
    const freeCreditDays = daysUntilBill + paymentDueDays;

    // Calculate current cycle spend
    const cardId = card.id || card.last4;
    const cycleSpend = expenses.filter(e => {
      const pm = (e.paymentMethod || '').toLowerCase();
      return pm.startsWith('credit_card') && pm.includes(String(cardId));
    }).reduce((s, e) => s + (e.amount || 0), 0);

    const currentUtil = Math.round((cycleSpend / limit) * 100);
    const projectedSpend = cycleSpend + amount;
    const projectedUtil = Math.round((projectedSpend / limit) * 100);
    const isRisk = projectedUtil > 30;

    // Rank primarily by free credit days, favoring non-risky utilization
    const effectiveScore = isRisk ? freeCreditDays - 20 : freeCreditDays;

    if (effectiveScore > maxFreeDays) {
      maxFreeDays = effectiveScore;
      bestCard = card;
      bestUtilization = currentUtil;
      bestProjected = projectedUtil;
      bestRisk = isRisk;
      bestReason = isRisk
        ? `${freeCreditDays} days free credit, but note utilization will reach ${projectedUtil}%`
        : `Gives ${freeCreditDays} days interest-free credit (${projectedUtil}% utilization)`;
    }
  }

  if (!bestCard) return null;

  return {
    recommendedCard: bestCard,
    freeDaysRemaining: maxFreeDays,
    currentUtilizationPct: bestUtilization,
    projectedUtilizationPct: bestProjected,
    isOverLimitRisk: bestRisk,
    reason: bestReason,
  };
}

/**
 * Opportunity Cost & Portfolio Compounding Simulator
 * Computes how much a discretionary spend amount would compound to in the user's
 * investment portfolio at conservative, moderate (13%), and optimistic CAGR over 3Y, 5Y, and 10Y.
 */
export interface OpportunityCostAnalysis {
  purchaseAmount: number;
  years3: number;
  years5: number;
  years10: number;
  cagrUsed: number;
  wealthLostComparisonText: string;
}

export function calculateOpportunityCost(purchaseAmount: number, cagr: number = 13): OpportunityCostAnalysis {
  const amt = Math.max(0, purchaseAmount);
  const rate = cagr / 100;

  const y3 = Math.round(amt * Math.pow(1 + rate, 3));
  const y5 = Math.round(amt * Math.pow(1 + rate, 5));
  const y10 = Math.round(amt * Math.pow(1 + rate, 10));

  return {
    purchaseAmount: amt,
    years3: y3,
    years5: y5,
    years10: y10,
    cagrUsed: cagr,
    wealthLostComparisonText: `If invested at ${cagr}% CAGR instead, this would compound to ₹${y5.toLocaleString('en-IN')} in 5 years (or ₹${y10.toLocaleString('en-IN')} in 10 years).`,
  };
}

