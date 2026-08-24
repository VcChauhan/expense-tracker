import mongoose, { Schema, Document } from 'mongoose';

export interface ISuggestion extends Document {
  smsBody?: string;
  sender: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedCategory?: string; // Optional: an initial guess for the category ID
  suggestedAccount?: string;  // Optional: an initial guess for the account ID
  suggestedLabel?: string;    // Optional: AI-generated transaction label
  suggestedTags?: string[];   // Optional: On-device suggested tags
  suggestedPaymentMethod?: string; // Optional: upi, credit_card, debit_card, netbanking
}

const SuggestionSchema = new Schema<ISuggestion>({
  smsBody: { type: String, default: '' },
  sender: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  suggestedCategory: { type: String, required: false },
  suggestedAccount: { type: String, required: false },
  suggestedLabel: { type: String, required: false },
  suggestedTags: { type: [String], default: [] },
  suggestedPaymentMethod: { type: String, default: 'upi' },
}, { timestamps: true });

// Prevent model recompilation error in Next.js HMR
export default mongoose.models.Suggestion || mongoose.model<ISuggestion>('Suggestion', SuggestionSchema);
