import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategory {
  id: string;
  name: string;
  emoji: string;
  monthlyBudget: number;
  notes: string;
  color: string;
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
  expenseViewLayout?: 'list' | 'timeline';
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '💰' },
  monthlyBudget: { type: Number, required: true, default: 0 },
  notes: { type: String, default: '' },
  color: { type: String, default: '#6366f1' },
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
    expenseViewLayout: { type: String, enum: ['list', 'timeline'], default: 'list' },
  },
  { timestamps: true }
);

const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
