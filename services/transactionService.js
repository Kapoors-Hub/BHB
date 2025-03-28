// services/transactionService.js
const Hunter = require('../models/Hunter');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Create a transaction and update hunter's wallet
 * @param {Object} transactionData - Transaction data
 * @returns {Object} - Transaction document
 */
exports.createTransaction = async (transactionData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      hunterId,
      amount,
      type,
      category,
      description,
      reference,
      referenceModel,
      initiatedBy,
      metaData
    } = transactionData;

    // Find hunter with session for transaction safety
    const hunter = await Hunter.findById(hunterId).session(session);
    if (!hunter) {
      throw new Error('Hunter not found');
    }

    // Calculate balances
    const balanceBefore = hunter.wallet;
    let balanceAfter = balanceBefore;

    if (type === 'credit') {
      balanceAfter += amount;
    } else {
      // Check if sufficient balance for debits
      if (balanceBefore < amount) {
        throw new Error('Insufficient balance');
      }
      balanceAfter -= amount;
    }

    // Create transaction
    const transaction = await Transaction.create([{
      hunter: hunterId,
      amount,
      type,
      category,
      description,
      reference,
      referenceModel,
      balanceBefore,
      balanceAfter,
      initiatedBy,
      metaData,
      createdAt: new Date()
    }], { session });

    // Update hunter's wallet
    await Hunter.findByIdAndUpdate(
      hunterId,
      { wallet: balanceAfter },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return transaction[0];
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Get hunter's transaction history
 * @param {string} hunterId - Hunter ID
 * @param {Object} options - Query options
 * @returns {Array} - Array of transaction documents
 */
exports.getTransactionHistory = async (hunterId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    type,
    category,
    startDate,
    endDate,
    sort = { createdAt: -1 }
  } = options;

  const query = { hunter: hunterId };

  if (type) query.type = type;
  if (category) query.category = category;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  
  const transactions = await Transaction.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('reference')
    .populate('initiatedBy.id');
  
  const total = await Transaction.countDocuments(query);

  return {
    transactions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit)
    }
  };
};

/**
 * Get wallet summary for a hunter
 * @param {string} hunterId - Hunter ID
 * @returns {Object} - Wallet summary
 */
exports.getWalletSummary = async (hunterId) => {
  const hunter = await Hunter.findById(hunterId);
  if (!hunter) {
    throw new Error('Hunter not found');
  }

  // Get total credits and debits
  const [creditAgg, debitAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { hunter:new mongoose.Types.ObjectId(hunterId), type: 'credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { hunter:new  mongoose.Types.ObjectId(hunterId), type: 'debit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  // Get latest transactions
  const recentTransactions = await Transaction.find({ hunter: hunterId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('reference');

  return {
    currentBalance: hunter.wallet,
    totalCredits: creditAgg.length > 0 ? creditAgg[0].total : 0,
    totalDebits: debitAgg.length > 0 ? debitAgg[0].total : 0,
    recentTransactions
  };
};

module.exports = exports;