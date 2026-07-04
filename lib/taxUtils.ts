/**
 * Indian Salary Tax Calculator — FY 2025-26
 * Supports New Tax Regime (default) and Old Tax Regime
 */

export interface SalaryBreakdown {
  annualGross: number;
  basicAnnual: number;
  basicMonthly: number;
  // EPF
  epfEmployee: number;      // Annual employee EPF (12% of basic)
  epfEmployeeMonthly: number;
  // Tax
  standardDeduction: number;
  deductionsApplied: number; // 80C + 80D etc (old regime only)
  taxableIncome: number;
  incomeTaxBeforeCess: number;
  cess: number;             // 4% health & education cess
  annualTax: number;        // after cess
  // Other
  professionalTax: number;  // Annual ₹2,400 (₹200/month)
  // Final
  annualInhand: number;
  monthlyInhand: number;
  monthlyGross: number;
  effectiveTaxRate: number; // %
}

// New Tax Regime slabs — FY 2025-26 (Budget 2025)
const NEW_REGIME_SLABS = [
  { limit: 400000,  rate: 0 },
  { limit: 800000,  rate: 0.05 },
  { limit: 1200000, rate: 0.10 },
  { limit: 1600000, rate: 0.15 },
  { limit: 2000000, rate: 0.20 },
  { limit: 2400000, rate: 0.25 },
  { limit: Infinity, rate: 0.30 },
];
const NEW_STANDARD_DEDUCTION = 75000;
// 87A rebate: if net taxable income ≤ ₹12L → full rebate (zero tax)
const NEW_REBATE_LIMIT = 1200000;

// Old Tax Regime slabs
const OLD_REGIME_SLABS = [
  { limit: 250000,  rate: 0 },
  { limit: 500000,  rate: 0.05 },
  { limit: 1000000, rate: 0.20 },
  { limit: Infinity, rate: 0.30 },
];
const OLD_STANDARD_DEDUCTION = 50000;
// 87A rebate: if net taxable income ≤ ₹5L → full rebate
const OLD_REBATE_LIMIT = 500000;

function computeTaxFromSlabs(
  taxableIncome: number,
  slabs: { limit: number; rate: number }[]
): number {
  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, slab.limit) - prev;
    tax += taxable * slab.rate;
    prev = slab.limit;
  }
  return Math.max(0, tax);
}

export function computeSalaryBreakdown(
  annualGross: number,
  regime: 'new' | 'old',
  basicPercent: number = 50,
  deductions80C: number = 0,
  deductions80D: number = 0,
  otherDeductions: number = 0,
): SalaryBreakdown {
  if (!annualGross || annualGross <= 0) {
    return {
      annualGross: 0, basicAnnual: 0, basicMonthly: 0,
      epfEmployee: 0, epfEmployeeMonthly: 0,
      standardDeduction: 0, deductionsApplied: 0,
      taxableIncome: 0, incomeTaxBeforeCess: 0, cess: 0, annualTax: 0,
      professionalTax: 0,
      annualInhand: 0, monthlyInhand: 0, monthlyGross: 0, effectiveTaxRate: 0,
    };
  }

  // Basic salary = basicPercent% of gross
  const basicAnnual = Math.round((basicPercent / 100) * annualGross);
  const basicMonthly = Math.round(basicAnnual / 12);

  // Employee EPF = 12% of basic (capped at ₹15,000/month basic per EPFO mandate)
  const epfBasicMonthly = Math.min(basicMonthly, 15000);
  const epfEmployeeMonthly = Math.round(epfBasicMonthly * 0.12);
  const epfEmployee = epfEmployeeMonthly * 12;

  // Professional Tax (₹200/month — standard across most Indian states)
  const professionalTax = 2400;

  // ----- Tax Calculation -----
  let standardDeduction: number;
  let deductionsApplied = 0;

  if (regime === 'new') {
    standardDeduction = NEW_STANDARD_DEDUCTION;
    // New regime: no 80C/80D allowed (only standard deduction)
  } else {
    standardDeduction = OLD_STANDARD_DEDUCTION;
    // Old regime: 80C capped at 1.5L, 80D capped at 25K (basic) or 50K (senior)
    const cap80C = Math.min(deductions80C, 150000);
    const cap80D = Math.min(deductions80D, 25000);
    deductionsApplied = cap80C + cap80D + otherDeductions;
  }

  // Taxable income = Gross - Standard Deduction - Other deductions (old regime only)
  const grossAfterStdDed = Math.max(0, annualGross - standardDeduction);
  const taxableIncome = Math.max(0, grossAfterStdDed - deductionsApplied);

  // Compute tax
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  let incomeTaxBeforeCess = computeTaxFromSlabs(taxableIncome, slabs);

  // Section 87A rebate
  const rebateLimit = regime === 'new' ? NEW_REBATE_LIMIT : OLD_REBATE_LIMIT;
  if (taxableIncome <= rebateLimit) {
    incomeTaxBeforeCess = 0;
  }

  // 4% Health & Education Cess
  const cess = Math.round(incomeTaxBeforeCess * 0.04);
  const annualTax = incomeTaxBeforeCess + cess;

  // Annual in-hand = Gross - EPF Employee - Income Tax - Professional Tax
  const annualInhand = annualGross - epfEmployee - annualTax - professionalTax;
  const monthlyInhand = Math.round(annualInhand / 12);
  const monthlyGross = Math.round(annualGross / 12);
  const effectiveTaxRate = annualGross > 0 ? parseFloat(((annualTax / annualGross) * 100).toFixed(2)) : 0;

  return {
    annualGross, basicAnnual, basicMonthly,
    epfEmployee, epfEmployeeMonthly,
    standardDeduction, deductionsApplied,
    taxableIncome, incomeTaxBeforeCess, cess, annualTax,
    professionalTax,
    annualInhand, monthlyInhand, monthlyGross, effectiveTaxRate,
  };
}
