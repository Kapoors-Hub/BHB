// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  hunter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hunter',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: ['bounty', 'quiz', 'admin', 'withdrawal', 'deposit', 'refund', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    // Can be bounty ID, quiz ID, etc.
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Bounty', 'Quiz', 'Admin', null]
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  initiatedBy: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'initiatedBy.role'
    },
    role: {
      type: String,
      enum: ['Admin', 'Hunter', 'System', 'Lord']
    }
  },
  metaData: {
  type: mongoose.Schema.Types.Mixed  // This is the correct syntax
},
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
transactionSchema.index({ hunter: 1, createdAt: -1 });
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);