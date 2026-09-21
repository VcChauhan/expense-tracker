// Shared types across the app

export interface Category {
  id: string;
  name: string;
  emoji: string;
  monthlyBudget: number;
  notes: string;
  color: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  icon: string;
  color: string;
}

export interface QuickTemplate {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  tags: string[];
  icon: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number; // 1 - 31
  isActive: boolean;
  lastLoggedMonth?: string; // e.g. "2026-09"
}

export interface NetWorthEntry {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  amount: number;
  category: string; // e.g. "Bank", "MF / Stocks", "EPF / PF", "Real Estate", "Loan", "Card Due"
  lastUpdated: string;
}

export interface InvestmentFund {
  name: string;
  invested: number;
  current: number;
  gain: number;
  gainPercent: number;
}

export type PortfolioType = 'mutual_funds' | 'stocks' | 'combined';

export interface InvestmentSnapshot {
  _id?: string;
  date: string;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
  source: 'groww' | 'manual';
  portfolioType: PortfolioType;
  funds?: InvestmentFund[];
  screenshotUrl?: string;
  createdAt?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  last4?: string;
  limit: number;
  billingDay: number; // statement generated on this day of month
  paymentDueDays: number; // e.g. 20 days after bill date
  color: string;
}

export interface Settings {
  _id?: string;
  annualSalary: number;
  monthlySalary: number;        // computed in-hand
  taxRegime?: 'new' | 'old';
  basicPercent?: number;
  deductions80C?: number;
  deductions80D?: number;
  otherDeductions?: number;
  epfMonthly?: number;
  annualTax?: number;
  professionalTax?: number;
  taxableIncome?: number;
  effectiveTaxRate?: number;
  categories: Category[];
  savingsGoals?: SavingsGoal[];
  quickTemplates?: QuickTemplate[];
  recurringExpenses?: RecurringExpense[];
  netWorthEntries?: NetWorthEntry[];
  creditCards?: CreditCard[];
  expenseViewLayout?: 'list' | 'timeline' | 'calendar';
  updatedAt?: string;
}

export type PaymentMethod = 'upi' | 'credit_card' | 'debit_card' | 'netbanking' | 'cash' | 'other';
/** A payment method value as actually stored — allows "credit_card:XX1234" to reference a specific saved card. */
export type PaymentMethodValue = PaymentMethod | `credit_card:${string}`;

export interface Expense {
  _id: string;
  date: string;
  categoryId: string;
  amount: number;
  note: string;
  tags: string[];
  paymentMethod?: PaymentMethodValue;
  createdAt: string;
}

export interface Suggestion {
  _id: string;
  smsBody: string;
  sender: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedCategory?: string;
  suggestedLabel?: string;
  suggestedTags?: string[];
  suggestedPaymentMethod?: PaymentMethod;
}

export interface MonthlyAnalytics {
  categoryTotals: { _id: string; total: number; count: number }[];
  overall: number;
  recent: Expense[];
  month: string;
  year: string;
}

export interface AnnualAnalytics {
  categoryMonthly: { _id: { month: string; categoryId: string }; total: number }[];
  monthTotals: { _id: string; total: number; count: number }[];
  year: string;
}

// Format INR currency
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getBudgetStatus(pct: number): 'safe' | 'warning' | 'danger' {
  if (pct >= 100) return 'danger';
  if (pct >= 80) return 'warning';
  return 'safe';
}
