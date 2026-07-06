import mongoose, { Schema, Document } from 'mongoose';

export interface ISuggestion extends Document {
  smsBody: string;
  sender: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedCategory?: string; // Optional: an initial guess for the category ID
}

const SuggestionSchema = new Schema<ISuggestion>({
  smsBody: { type: String, required: true },
  sender: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  suggestedCategory: { type: String, required: false },
}, { timestamps: true });

// Prevent model recompilation error in Next.js HMR
export default mongoose.models.Suggestion || mongoose.model<ISuggestion>('Suggestion', SuggestionSchema);
