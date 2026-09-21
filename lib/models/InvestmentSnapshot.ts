import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvestmentFund {
  name: string;
  invested: number;
  current: number;
  gain: number;
  gainPercent: number;
}

export interface IInvestmentSnapshot extends Document {
  date: string; // YYYY-MM-DD
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
  source: string; // 'groww' | 'manual'
  funds: IInvestmentFund[];
  screenshotUrl?: string;
  createdAt: Date;
}

const InvestmentFundSchema = new Schema<IInvestmentFund>(
  {
    name: { type: String, required: true },
    invested: { type: Number, required: true, default: 0 },
    current: { type: Number, required: true, default: 0 },
    gain: { type: Number, required: true, default: 0 },
    gainPercent: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const InvestmentSnapshotSchema = new Schema<IInvestmentSnapshot>(
  {
    date: { type: String, required: true },
    totalInvested: { type: Number, required: true, default: 0 },
    currentValue: { type: Number, required: true, default: 0 },
    totalGain: { type: Number, required: true, default: 0 },
    gainPercent: { type: Number, required: true, default: 0 },
    source: { type: String, default: 'groww' },
    funds: { type: [InvestmentFundSchema], default: [] },
    screenshotUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

InvestmentSnapshotSchema.index({ date: -1 });

const InvestmentSnapshot: Model<IInvestmentSnapshot> =
  mongoose.models.InvestmentSnapshot ||
  mongoose.model<IInvestmentSnapshot>('InvestmentSnapshot', InvestmentSnapshotSchema);

export default InvestmentSnapshot;
