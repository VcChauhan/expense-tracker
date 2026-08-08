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
  expenseViewLayout?: 'list' | 'timeline';
  updatedAt?: string;
}

export interface Expense {
  _id: string;
  date: string;
  categoryId: string;
  amount: number;
  note: string;
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
