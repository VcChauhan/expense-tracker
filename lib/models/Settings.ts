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
  monthlySalary: number;
  categories: ICategory[];
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
    annualSalary: { type: Number, required: true, default: 0 },
    monthlySalary: { type: Number, required: true, default: 0 },
    categories: { type: [CategorySchema], default: [] },
  },
  { timestamps: true }
);

const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
