import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHikeCategory {
  id: string;
  name: string;
  emoji: string;
  previousBudget: number;
  newBudget: number;
}

export interface IHikeHistory extends Document {
  year: number;
  hikePercent: number;
  previousAnnualSalary: number;
  newAnnualSalary: number;
  previousMonthlyInhand: number;
  newMonthlyInhand: number;
  categories: IHikeCategory[];
  appliedAt: Date;
}

const HikeCategorySchema = new Schema<IHikeCategory>({
  id:             { type: String, required: true },
  name:           { type: String, required: true },
  emoji:          { type: String, default: '💰' },
  previousBudget: { type: Number, required: true },
  newBudget:      { type: Number, required: true },
});

const HikeHistorySchema = new Schema<IHikeHistory>(
  {
    year:                 { type: Number, required: true },
    hikePercent:          { type: Number, required: true },
    previousAnnualSalary: { type: Number, required: true },
    newAnnualSalary:      { type: Number, required: true },
    previousMonthlyInhand:{ type: Number, required: true },
    newMonthlyInhand:     { type: Number, required: true },
    categories:           { type: [HikeCategorySchema], default: [] },
    appliedAt:            { type: Date, default: Date.now },
  }
);

const HikeHistory: Model<IHikeHistory> =
  mongoose.models.HikeHistory || mongoose.model<IHikeHistory>('HikeHistory', HikeHistorySchema);

export default HikeHistory;
