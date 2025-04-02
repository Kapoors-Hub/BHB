// controllers/withdrawalController.js
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Hunter = require('../models/Hunter');
const Transaction = require('../models/Transaction');
const transactionService = require('../services/transactionService');
const notificationController = require('./notificationController');

const withdrawalController = {
  
  // Request a withdrawal
  async requestWithdrawal(req, res) {
    try {
      const hunterId = req.hunter.id;
      const { amount, bankAccount, upiId, paymentMethod, remarks } = req.body;
      console.log(amount)
      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Withdrawal amount must be positive'
        });
      }
      
      // Validate payment method
      if (!paymentMethod || !['bank_transfer', 'upi', 'other'].includes(paymentMethod)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid payment method is required'
        });
      }
      
      // Validate payment details based on method
      if (paymentMethod === 'bank_transfer' && (!bankAccount || !bankAccount.accountNumber || !bankAccount.ifscCode)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Bank account details are required for bank transfers'
        });
      }
      
      if (paymentMethod === 'upi' && !upiId) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'UPI ID is required for UPI transfers'
        });
      }
      
      // Check if hunter has sufficient balance
      const hunter = await Hunter.findById(hunterId);
      if (hunter.wallet < amount) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Insufficient wallet balance',
          data: {
            availableBalance: hunter.wallet,
            requestedAmount: amount
          }
        });
      }
      
      // Check if there's already a pending request
      const pendingRequest = await WithdrawalRequest.findOne({
        hunter: hunterId,
        status: 'pending'
      });
      
      if (pendingRequest) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You already have a pending withdrawal request',
          data: {
            pendingRequest
          }
        });
      }
      
      // Create a pending transaction first
      const pendingTransaction = await transactionService.createTransaction({
        hunterId: hunterId,
        amount: amount,
        type: 'debit',
        status: 'pending',
        category: 'withdrawal',
        description: `Withdrawal request via ${paymentMethod}`,
        initiatedBy: {
          id: hunterId,
          role: 'Hunter'
        },
        metaData: {
          paymentMethod: paymentMethod
        }
      });
      
      // Create withdrawal request with transaction reference
      const withdrawalRequest = await WithdrawalRequest.create({
        hunter: hunterId,
        amount,
        bankAccount,
        upiId,
        paymentMethod,
        remarks,
        requestedAt: new Date(),
        transactionId: pendingTransaction._id
      });
      
      // Update transaction with withdrawal request reference
      await Transaction.findByIdAndUpdate(pendingTransaction._id, {
        metaData: {
          ...pendingTransaction.metaData,
          withdrawalRequestId: withdrawalRequest._id
        }
      });
      
      // Create notification
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Withdrawal Request Submitted',
        message: `Your withdrawal request for ${amount} has been submitted and is pending approval.`,
        type: 'system'
      });
      
      return res.status(201).json({
        status: 201,
        success: true,
        message: 'Withdrawal request submitted successfully',
        data: {
          withdrawalRequest,
          transaction: pendingTransaction
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error creating withdrawal request',
        error: error.message
      });
    }
  },

  // Get my withdrawal requests
  async getMyWithdrawalRequests(req, res) {
    try {
      const hunterId = req.hunter.id;
      const { status, page = 1, limit = 10 } = req.query;
      
      const query = { hunter: hunterId };
      if (status) query.status = status;
      
      const skip = (page - 1) * limit;
      
      const requests = await WithdrawalRequest.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      const total = await WithdrawalRequest.countDocuments(query);
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Withdrawal requests retrieved successfully',
        data: {
          requests,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving withdrawal requests',
        error: error.message
      });
    }
  },
  
  // Cancel withdrawal request (only if pending)
  async cancelWithdrawalRequest(req, res) {
    try {
      const hunterId = req.hunter.id;
      const { requestId } = req.params;
      
      const withdrawalRequest = await WithdrawalRequest.findOne({
        _id: requestId,
        hunter: hunterId,
        status: 'pending'
      });
      
      if (!withdrawalRequest) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Pending withdrawal request not found or not cancelable'
        });
      }
      
      withdrawalRequest.status = 'rejected';
      withdrawalRequest.remarks = 'Cancelled by hunter';
      await withdrawalRequest.save();
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Withdrawal request cancelled successfully',
        data: withdrawalRequest
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error cancelling withdrawal request',
        error: error.message
      });
    }
  },
  
  // Admin methods
  
  // Get all withdrawal requests
  async getAllWithdrawalRequests(req, res) {
    try {
      const { status, hunterId, page = 1, limit = 10 } = req.query;
      
      const query = {};
      if (status) query.status = status;
      if (hunterId) query.hunter = hunterId;
      
      const skip = (page - 1) * limit;
      
      const requests = await WithdrawalRequest.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('hunter', 'name username email wallet');
      
      const total = await WithdrawalRequest.countDocuments(query);
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Withdrawal requests retrieved successfully',
        data: {
          requests,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving withdrawal requests',
        error: error.message
      });
    }
  },
  
  // Process withdrawal request
  async processWithdrawalRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { status, adminNotes } = req.body;
      const adminId = req.admin.id;
 
      // Validate status
      if (!status || !['approved', 'rejected', 'processing', 'completed'].includes(status)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid status is required'
        });
      }
      
      // Find the request
      const withdrawalRequest = await WithdrawalRequest.findById(requestId)
        .populate('hunter');
      
      if (!withdrawalRequest || withdrawalRequest.status !== 'pending') {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Pending withdrawal request not found'
        });
      }
      
      // Check if a transaction already exists for this request
      let transaction = null;
      if (withdrawalRequest.transactionId) {
        transaction = await Transaction.findById(withdrawalRequest.transactionId);
      }
      
      // Process based on new status
      if (status === 'completed' || status === 'approved') {
        // Check if hunter has sufficient balance
        const hunter = await Hunter.findById(withdrawalRequest.hunter._id);
        
        if (hunter.wallet < withdrawalRequest.amount) {
          return res.status(400).json({
            status: 400,
            success: false,
            message: 'Hunter has insufficient balance',
            data: {
              availableBalance: hunter.wallet,
              requestedAmount: withdrawalRequest.amount
            }
          });
        }
        
        // If transaction doesn't exist, create one; otherwise update the existing one
        if (!transaction) {
          transaction = await transactionService.createTransaction({
            hunterId: withdrawalRequest.hunter._id,
            amount: withdrawalRequest.amount,
            type: 'debit',
            status: status === 'completed' ? 'completed' : 'processing',
            category: 'withdrawal',
            description: `Withdrawal via ${withdrawalRequest.paymentMethod}`,
            initiatedBy: {
              id: adminId,
              role: 'Admin'
            },
            metaData: {
              withdrawalRequestId: withdrawalRequest._id,
              paymentMethod: withdrawalRequest.paymentMethod
            }
          });
          
          // Link the transaction to the withdrawal request
          withdrawalRequest.transactionId = transaction._id;
        } else {
          // Update existing transaction
          transaction.status = status === 'completed' ? 'completed' : 'processing';
          transaction.processedBy = adminId;
          transaction.processedAt = new Date();
          await transaction.save();
        }
        
        // If completed, deduct from wallet
        if (status === 'completed') {
          await Hunter.findByIdAndUpdate(
            withdrawalRequest.hunter._id,
            { $inc: { wallet: -withdrawalRequest.amount } }
          );
        }
        
        // Update withdrawal request
        withdrawalRequest.status = status;
        withdrawalRequest.processedAt = new Date();
        withdrawalRequest.processedBy = adminId;
        withdrawalRequest.adminNotes = adminNotes;
        
        // Send notification to hunter
        await notificationController.createNotification({
          hunterId: withdrawalRequest.hunter._id,
          title: 'Withdrawal Request ' + (status === 'approved' ? 'Approved' : 'Completed'),
          message: `Your withdrawal request for ${withdrawalRequest.amount} has been ${status}. ${adminNotes || ''}`,
          type: 'system'
        });
      } else if (status === 'rejected') {
        // If transaction exists, mark it as canceled
        if (transaction) {
          transaction.status = 'canceled';
          transaction.processedBy = adminId;
          transaction.processedAt = new Date();
          await transaction.save();
        }
        
        // Update withdrawal request
        withdrawalRequest.status = status;
        withdrawalRequest.processedAt = new Date();
        withdrawalRequest.processedBy = adminId;
        withdrawalRequest.adminNotes = adminNotes;
        
        // Send notification to hunter
        await notificationController.createNotification({
          hunterId: withdrawalRequest.hunter._id,
          title: 'Withdrawal Request Rejected',
          message: `Your withdrawal request for ${withdrawalRequest.amount} has been rejected. ${adminNotes || ''}`,
          type: 'system'
        });
      } else {
        // For other statuses (like 'processing')
        // If transaction exists, update its status
        if (transaction) {
          transaction.status = status;
          transaction.processedBy = adminId;
          transaction.processedAt = new Date();
          await transaction.save();
        }
        
        // Update withdrawal request
        withdrawalRequest.status = status;
        withdrawalRequest.processedAt = new Date();
        withdrawalRequest.processedBy = adminId;
        withdrawalRequest.adminNotes = adminNotes;
        
        // Send notification to hunter
        await notificationController.createNotification({
          hunterId: withdrawalRequest.hunter._id,
          title: 'Withdrawal Request ' + status.charAt(0).toUpperCase() + status.slice(1),
          message: `Your withdrawal request for ${withdrawalRequest.amount} is now ${status}. ${adminNotes || ''}`,
          type: 'system'
        });
      }
      
      // Save the updated withdrawal request
      await withdrawalRequest.save();
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: `Withdrawal request ${status} successfully`,
        data: {
          withdrawalRequest,
          transaction
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error processing withdrawal request',
        error: error.message
      });
    }
  }
  
};

module.exports = withdrawalController;