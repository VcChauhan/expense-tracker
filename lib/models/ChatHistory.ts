import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  role: {
    type: String, // 'user' or 'ai'
    required: true,
  },
  content: {
    type: String, // Text to show in UI
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // e.g., the mini-table data, action type, or affordibility math
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.models.ChatHistory || mongoose.model('ChatHistory', chatHistorySchema);
