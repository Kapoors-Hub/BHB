// controllers/withdrawalController.js
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Hunter = require('../models/Hunter');
const Transaction = require('../models/Transaction');
const transactionService = require('../services/transactionService');
const notificationController = require('./notificationController');

const withdrawalController = {
  // Hunter methods
  
  // Request a withdrawal
  async requestWithdrawal(req, res) {
    try {
      const hunterId = req.hunter.id;
      const { amount, bankAccount, upiId, paymentMethod, remarks } = req.body;
      
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
      
      // Create withdrawal request
      const withdrawalRequest = await WithdrawalRequest.create({
        hunter: hunterId,
        amount,
        bankAccount,
        upiId,
        paymentMethod,
        remarks,
        requestedAt: new Date()
      });
      
      // Create notification for admin (if you have an admin notification system)
      // ...
      
      return res.status(201).json({
        status: 201,
        success: true,
        message: 'Withdrawal request submitted successfully',
        data: withdrawalRequest
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
        
        // Create transaction record for the withdrawal
        const transaction = await transactionService.createTransaction({
          hunterId: withdrawalRequest.hunter._id,
          amount: withdrawalRequest.amount,
          type: 'debit',
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
        
        // Update withdrawal request
        withdrawalRequest.status = status;
        withdrawalRequest.processedAt = new Date();
        withdrawalRequest.processedBy = adminId;
        withdrawalRequest.adminNotes = adminNotes;
        withdrawalRequest.transactionId = transaction._id;
        
        // Send notification to hunter
        await notificationController.createNotification({
          hunterId: withdrawalRequest.hunter._id,
          title: 'Withdrawal Request ' + (status === 'approved' ? 'Approved' : 'Completed'),
          message: `Your withdrawal request for ${withdrawalRequest.amount} has been ${status}. ${adminNotes || ''}`,
          type: 'system'
        });
      } else {
        // Just update the status without financial transaction
        withdrawalRequest.status = status;
        withdrawalRequest.processedAt = new Date();
        withdrawalRequest.processedBy = adminId;
        withdrawalRequest.adminNotes = adminNotes;
        
        // Send notification to hunter
        let notificationMessage = '';
        if (status === 'rejected') {
          notificationMessage = `Your withdrawal request for ${withdrawalRequest.amount} has been rejected. ${adminNotes || ''}`;
        } else {
          notificationMessage = `Your withdrawal request for ${withdrawalRequest.amount} is now ${status}. ${adminNotes || ''}`;
        }
        
        await notificationController.createNotification({
          hunterId: withdrawalRequest.hunter._id,
          title: 'Withdrawal Request ' + status.charAt(0).toUpperCase() + status.slice(1),
          message: notificationMessage,
          type: 'system'
        });
      }
      
      await withdrawalRequest.save();
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: `Withdrawal request ${status} successfully`,
        data: withdrawalRequest
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