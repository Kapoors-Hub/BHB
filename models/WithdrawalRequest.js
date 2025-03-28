// models/WithdrawalRequest.js
const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  hunter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hunter',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [1, 'Withdrawal amount must be positive']
  },
  bankAccount: {
    accountNumber: String,
    bankName: String,
    accountHolderName: String,
    ifscCode: String
  },
  upiId: String,
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  remarks: String,
  adminNotes: String
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);