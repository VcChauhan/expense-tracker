import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvestmentFund {
  name: string;
  invested: number;
  current: number;
  gain: number;
  gainPercent: number;
  units?: number;
  buyPrice?: number;
}

export interface IInvestmentSnapshot extends Document {
  holdingName?: string;
  date: string;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  gainPercent: number;
  oneDayGain?: number;
  oneDayGainPercent?: number;
  source: string;
  portfolioType: string; // 'mutual_funds' | 'stocks' | 'gold' | 'combined'
  funds: IInvestmentFund[];
  units?: number;
  buyPrice?: number;
  purchaseTime?: string;
  screenshotUrl?: string;
  tag?: string;
  createdAt: Date;
}

const InvestmentFundSchema = new Schema<IInvestmentFund>(
  {
    name: { type: String, required: true },
    invested: { type: Number, required: true, default: 0 },
    current: { type: Number, required: true, default: 0 },
    gain: { type: Number, required: true, default: 0 },
    gainPercent: { type: Number, required: true, default: 0 },
    units: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const InvestmentSnapshotSchema = new Schema<IInvestmentSnapshot>(
  {
    holdingName: { type: String, default: '' },
    date: { type: String, required: true },
    totalInvested: { type: Number, required: true, default: 0 },
    currentValue: { type: Number, required: true, default: 0 },
    totalGain: { type: Number, required: true, default: 0 },
    gainPercent: { type: Number, required: true, default: 0 },
    oneDayGain: { type: Number, default: 0 },
    oneDayGainPercent: { type: Number, default: 0 },
    source: { type: String, default: 'groww' },
    portfolioType: { type: String, default: 'combined' },
    funds: { type: [InvestmentFundSchema], default: [] },
    units: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 },
    purchaseTime: { type: String, default: '' },
    screenshotUrl: { type: String, default: '' },
    tag: { type: String, default: '' },
  },
  { timestamps: true }
);

InvestmentSnapshotSchema.index({ date: -1 });
InvestmentSnapshotSchema.index({ portfolioType: 1, date: -1 });

const InvestmentSnapshot: Model<IInvestmentSnapshot> =
  mongoose.models.InvestmentSnapshot ||
  mongoose.model<IInvestmentSnapshot>('InvestmentSnapshot', InvestmentSnapshotSchema);

export default InvestmentSnapshot;
