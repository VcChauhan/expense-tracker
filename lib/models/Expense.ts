import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IExpense extends Document {
  date: string;
  categoryId: string;
  amount: number;
  note: string;
  merchant?: string;    // Original merchant name (e.g. "Vijeta Supermarket") — separate from user note
  tags: string[];
  paymentMethod: string;
  isOneOff?: boolean;
  oneOffType?: 'annual' | 'festival' | 'travel' | 'medical' | 'emergency' | 'other' | '';
  aiNote?: string;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    categoryId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    merchant: { type: String, default: '' },  // Raw merchant name for learning/memory
    tags: { type: [String], default: [] },
    paymentMethod: { type: String, default: 'upi' },
    isOneOff: { type: Boolean, default: false },
    oneOffType: { type: String, default: '' },
    aiNote: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for efficient querying by date
ExpenseSchema.index({ date: 1 });
ExpenseSchema.index({ categoryId: 1 });
ExpenseSchema.index({ merchant: 1 });  // New index for merchant memory lookups

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

export default Expense;
