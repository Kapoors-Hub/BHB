// services/transactionService.js
const Hunter = require('../models/Hunter');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Create a transaction and update hunter's wallet if needed
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
      metaData,
      status = 'completed' // Default to completed if not specified
    } = transactionData;

    // Find hunter with session for transaction safety
    const hunter = await Hunter.findById(hunterId).session(session);
    if (!hunter) {
      throw new Error('Hunter not found');
    }

    // Calculate balances
    const balanceBefore = hunter.wallet;
    let balanceAfter = balanceBefore;

    // Only update balance for completed transactions
    if (status === 'completed') {
      if (type === 'credit') {
        balanceAfter += amount;
      } else {
        // Check if sufficient balance for debits
        if (balanceBefore < amount) {
          throw new Error('Insufficient balance');
        }
        balanceAfter -= amount;
      }
    } else {
      // For pending transactions, balance doesn't change yet
      balanceAfter = balanceBefore;
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
      status,
      initiatedBy,
      metaData,
      createdAt: new Date()
    }], { session });

    // Update hunter's wallet only for completed transactions
    if (status === 'completed') {
      await Hunter.findByIdAndUpdate(
        hunterId,
        { wallet: balanceAfter },
        { session }
      );
    }

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
 * Get hunter's transaction history including pending transactions
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
    status,
    sort = { createdAt: -1 }
  } = options;

  const query = { hunter: hunterId };

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDateTime;
    }
  }

  const skip = (page - 1) * limit;
  
  const transactions = await Transaction.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('reference')
    .populate('initiatedBy.id')
    .populate('processedBy');
  
  const total = await Transaction.countDocuments(query);

  // Calculate totals for different transaction categories
  const [creditTotal, debitTotal, pendingWithdrawals] = await Promise.all([
    Transaction.aggregate([
      { 
        $match: { 
          hunter: new mongoose.Types.ObjectId(hunterId), 
          type: 'credit', 
          status: 'completed' 
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { 
        $match: { 
          hunter: new mongoose.Types.ObjectId(hunterId), 
          type: 'debit', 
          status: 'completed' 
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { 
        $match: { 
          hunter: new mongoose.Types.ObjectId(hunterId), 
          type: 'debit', 
          category: 'withdrawal',
          status: { $in: ['pending', 'processing'] }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  return {
    transactions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit)
    },
    summary: {
      totalCredit: creditTotal.length ? creditTotal[0].total : 0,
      totalDebit: debitTotal.length ? debitTotal[0].total : 0,
      pendingWithdrawals: pendingWithdrawals.length ? pendingWithdrawals[0].total : 0
    }
  };
};

/**
 * Get wallet summary for a hunter including pending transactions
 * @param {string} hunterId - Hunter ID
 * @returns {Object} - Wallet summary
 */
exports.getWalletSummary = async (hunterId) => {
  const hunter = await Hunter.findById(hunterId);
  if (!hunter) {
    throw new Error('Hunter not found');
  }

  // Get completed credits and debits
  const [creditAgg, debitAgg, pendingWithdrawals] = await Promise.all([
    Transaction.aggregate([
      { $match: { hunter: new mongoose.Types.ObjectId(hunterId), type: 'credit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { hunter: new mongoose.Types.ObjectId(hunterId), type: 'debit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { 
        $match: { 
          hunter: new mongoose.Types.ObjectId(hunterId), 
          type: 'debit', 
          category: 'withdrawal',
          status: { $in: ['pending', 'processing'] }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  // Get latest transactions including pending ones
  const recentTransactions = await Transaction.find({ hunter: hunterId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('reference');

  // Get pending transactions by category
  const pendingByCategory = await Transaction.aggregate([
    { 
      $match: { 
        hunter: new mongoose.Types.ObjectId(hunterId),
        status: { $in: ['pending', 'processing'] }
      } 
    },
    { 
      $group: { 
        _id: '$category', 
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      } 
    }
  ]);

  return {
    currentBalance: hunter.wallet,
    totalCredits: creditAgg.length > 0 ? creditAgg[0].total : 0,
    totalDebits: debitAgg.length > 0 ? debitAgg[0].total : 0,
    pendingWithdrawals: pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0,
    pendingByCategory: pendingByCategory.reduce((obj, item) => {
      obj[item._id] = { total: item.total, count: item.count };
      return obj;
    }, {}),
    recentTransactions,
    availableBalance: hunter.wallet - (pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0)
  };
};

/**
 * Update a transaction's status
 * @param {string} transactionId - Transaction ID
 * @param {string} status - New status
 * @param {Object} updateData - Additional data to update
 * @returns {Object} - Updated transaction
 */
exports.updateTransactionStatus = async (transactionId, status, updateData = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const oldStatus = transaction.status;
    const hunter = await Hunter.findById(transaction.hunter).session(session);

    // If transitioning from pending/processing to completed for debits, deduct from wallet
    if ((oldStatus === 'pending' || oldStatus === 'processing') && 
        status === 'completed' && 
        transaction.type === 'debit') {
      
      if (hunter.wallet < transaction.amount) {
        throw new Error('Insufficient balance to complete transaction');
      }
      
      // Update hunter wallet
      await Hunter.findByIdAndUpdate(
        transaction.hunter,
        { $inc: { wallet: -transaction.amount } },
        { session }
      );
      
      // Update transaction balance fields
      transaction.balanceBefore = hunter.wallet;
      transaction.balanceAfter = hunter.wallet - transaction.amount;
    }
    
    // If transitioning from pending/processing to completed for credits, add to wallet
    if ((oldStatus === 'pending' || oldStatus === 'processing') && 
        status === 'completed' && 
        transaction.type === 'credit') {
      
      // Update hunter wallet
      await Hunter.findByIdAndUpdate(
        transaction.hunter,
        { $inc: { wallet: transaction.amount } },
        { session }
      );
      
      // Update transaction balance fields
      transaction.balanceBefore = hunter.wallet;
      transaction.balanceAfter = hunter.wallet + transaction.amount;
    }

    // Update transaction
    Object.assign(transaction, { status, ...updateData });
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

module.exports = exports;