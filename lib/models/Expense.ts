import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IExpense extends Document {
  date: string;
  categoryId: string;
  accountId?: string;
  amount: number;
  note: string;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    categoryId: { type: String, required: true },
    accountId: { type: String, required: false },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for efficient querying by date
ExpenseSchema.index({ date: 1 });
ExpenseSchema.index({ categoryId: 1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);

export default Expense;
