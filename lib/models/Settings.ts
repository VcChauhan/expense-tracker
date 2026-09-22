import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategory {
  id: string;
  name: string;
  emoji: string;
  monthlyBudget: number;
  notes: string;
  color: string;
}

export interface ISavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  icon: string;
  color: string;
}

export interface IQuickTemplate {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  tags: string[];
  icon: string;
}

export interface IRecurringExpense {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number;
  isActive: boolean;
  lastLoggedMonth?: string;
}

export interface INetWorthEntry {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  amount: number;
  category: string;
  lastUpdated: string;
}

export interface ICreditCard {
  id: string;
  name: string;
  last4?: string;
  limit: number;
  billingDay: number;
  paymentDueDays: number;
  color: string;
}

export interface IMonthNote {
  month: string;
  note: string;
}

export interface ISettings extends Document {
  annualSalary: number;
  monthlySalary: number;       // computed in-hand monthly
  // Tax fields
  taxRegime: 'new' | 'old';
  basicPercent: number;         // % of gross that is Basic (default 50)
  deductions80C: number;        // old regime only
  deductions80D: number;        // old regime only
  otherDeductions: number;      // old regime only
  // Computed breakdown (stored for display)
  epfMonthly: number;
  annualTax: number;
  professionalTax: number;
  taxableIncome: number;
  effectiveTaxRate: number;
  categories: ICategory[];
  savingsGoals: ISavingsGoal[];
  quickTemplates: IQuickTemplate[];
  recurringExpenses?: IRecurringExpense[];
  netWorthEntries?: INetWorthEntry[];
  creditCards?: ICreditCard[];
  monthNotes?: IMonthNote[];
  expenseViewLayout?: 'list' | 'timeline' | 'calendar';
  updatedAt: Date;
}

const MonthNoteSchema = new Schema<IMonthNote>({
  month: { type: String, required: true },
  note: { type: String, required: true },
});

const CategorySchema = new Schema<ICategory>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '💰' },
  monthlyBudget: { type: Number, required: true, default: 0 },
  notes: { type: String, default: '' },
  color: { type: String, default: '#6366f1' },
});

const SavingsGoalSchema = new Schema<ISavingsGoal>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true, default: 0 },
  currentAmount: { type: Number, required: true, default: 0 },
  targetDate: { type: String, required: true },
  icon: { type: String, default: '🎯' },
  color: { type: String, default: '#10b981' },
});

const QuickTemplateSchema = new Schema<IQuickTemplate>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  categoryId: { type: String, required: true },
  tags: { type: [String], default: [] },
  icon: { type: String, default: '⚡' },
});

const RecurringExpenseSchema = new Schema<IRecurringExpense>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  categoryId: { type: String, required: true },
  dayOfMonth: { type: Number, required: true, default: 1 },
  isActive: { type: Boolean, default: true },
  lastLoggedMonth: { type: String, default: '' },
});

const NetWorthEntrySchema = new Schema<INetWorthEntry>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['asset', 'liability'], required: true },
  amount: { type: Number, required: true, default: 0 },
  category: { type: String, default: 'General' },
  lastUpdated: { type: String, default: () => new Date().toISOString().split('T')[0] },
});

const CreditCardSchema = new Schema<ICreditCard>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  last4: { type: String, default: '' },
  limit: { type: Number, required: true, default: 0 },
  billingDay: { type: Number, required: true, default: 1 },
  paymentDueDays: { type: Number, default: 20 },
  color: { type: String, default: '#8b5cf6' },
});

const SettingsSchema = new Schema<ISettings>(
  {
    annualSalary:     { type: Number, required: true, default: 0 },
    monthlySalary:    { type: Number, required: true, default: 0 },
    taxRegime:        { type: String, enum: ['new', 'old'], default: 'new' },
    basicPercent:     { type: Number, default: 50 },
    deductions80C:    { type: Number, default: 0 },
    deductions80D:    { type: Number, default: 0 },
    otherDeductions:  { type: Number, default: 0 },
    epfMonthly:       { type: Number, default: 0 },
    annualTax:        { type: Number, default: 0 },
    professionalTax:  { type: Number, default: 2400 },
    taxableIncome:    { type: Number, default: 0 },
    effectiveTaxRate: { type: Number, default: 0 },
    categories:       { type: [CategorySchema], default: [] },
    savingsGoals:     { type: [SavingsGoalSchema], default: [] },
    quickTemplates:   { type: [QuickTemplateSchema], default: [] },
    recurringExpenses: { type: [RecurringExpenseSchema], default: [] },
    netWorthEntries:  { type: [NetWorthEntrySchema], default: [] },
    creditCards:      { type: [CreditCardSchema], default: [] },
    monthNotes:       { type: [MonthNoteSchema], default: [] },
    expenseViewLayout: { type: String, enum: ['list', 'timeline', 'calendar'], default: 'list' },
  },
  { timestamps: true }
);

delete mongoose.models.Settings;
const Settings: Model<ISettings> = mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
