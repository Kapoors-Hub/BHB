// controllers/transactionController.js
const Hunter = require('../models/Hunter');
const Transaction = require('../models/Transaction');
const transactionService = require('../services/transactionService');
const notificationController = require('./notificationController');

const transactionController = {
    // Create transaction (utility function to be used in other controllers)
    async createTransaction(transactionData) {
        try {
            const transaction = await transactionService.createTransaction(transactionData);
            return transaction;
        } catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }
    },

    // Get all transactions for a hunter
    async getMyTransactions(req, res) {
        try {
            const hunterId = req.hunter.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const { type, category, startDate, endDate, status } = req.query;
            
            // Include status in the parameters passed to the service
            const result = await transactionService.getTransactionHistory(hunterId, {
                page, 
                limit, 
                type, 
                category, 
                startDate, 
                endDate,
                status // Pass status if provided, otherwise it will fetch all statuses
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Transactions retrieved successfully',
                data: result
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching transactions',
                error: error.message
            });
        }
    },
    
    // Get wallet summary for a hunter
    async getMyWallet(req, res) {
        try {
            const hunterId = req.hunter.id;
            
            // Get wallet summary from transaction service
            const walletSummary = await transactionService.getWalletSummary(hunterId);
            
            // Get hunter's total earnings directly
            const hunter = await Hunter.findById(hunterId).select('totalEarnings');
            
            // Add total earnings to the wallet summary
            const enhancedWalletSummary = {
                ...walletSummary,
                totalEarnings: hunter.totalEarnings || 0  // Use 0 as fallback if field doesn't exist
            };
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Wallet summary retrieved successfully',
                data: enhancedWalletSummary
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving wallet summary',
                error: error.message
            });
        }
    },
    
    // For admins to add funds to a hunter's wallet
    async addFunds(req, res) {
        try {
            const { hunterId, amount, description, category, reference } = req.body;
            const adminId = req.admin.id;
            
            if (!hunterId || !amount || amount <= 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter ID and positive amount are required'
                });
            }
            
            const transaction = await transactionService.createTransaction({
                hunterId,
                amount,
                type: 'credit',
                category: category || 'admin',
                description: description || 'Funds added by admin',
                reference,
                referenceModel: reference ? 'Bounty' : null,
                initiatedBy: {
                    id: adminId,
                    role: 'Admin'
                }
            });
            
            // Send notification to hunter
            await notificationController.createNotification({
                hunterId,
                title: 'Funds Added',
                message: `${amount} has been added to your wallet${description ? `: ${description}` : ''}`,
                type: 'system'
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Funds added successfully',
                data: transaction
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error adding funds',
                error: error.message
            });
        }
    },
    
    // For admins to deduct funds from a hunter's wallet
    async deductFunds(req, res) {
        try {
            const { hunterId, amount, description, category } = req.body;
            const adminId = req.admin.id;
            
            if (!hunterId || !amount || amount <= 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter ID and positive amount are required'
                });
            }
            
            const transaction = await transactionService.createTransaction({
                hunterId,
                amount,
                type: 'debit',
                category: category || 'admin',
                description: description || 'Funds deducted by admin',
                initiatedBy: {
                    id: adminId,
                    role: 'Admin'
                }
            });
            
            // Send notification to hunter
            await notificationController.createNotification({
                hunterId,
                title: 'Funds Deducted',
                message: `${amount} has been deducted from your wallet${description ? `: ${description}` : ''}`,
                type: 'system'
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Funds deducted successfully',
                data: transaction
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deducting funds',
                error: error.message
            });
        }
    },
    
    // For admins to view a hunter's transaction history
    async getHunterTransactions(req, res) {
        try {
            const { hunterId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const { type, category, startDate, endDate } = req.query;
            
            const result = await transactionService.getTransactionHistory(hunterId, {
                page, limit, type, category, startDate, endDate
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Transaction history retrieved successfully',
                data: result
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving transaction history',
                error: error.message
            });
        }
    },

    // Add to transactionController.js
async getAllMyActivities(req, res) {
    try {
        const hunterId = req.hunter.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Query parameters for filtering
        const { 
            type,           // credit/debit
            category,       // withdrawal, bounty, etc.
            startDate, 
            endDate,
            minAmount,
            maxAmount,
            status          // include pending status filter
        } = req.query;
        
        // Build query object - always filter by hunterId
        const query = { hunter: hunterId };
        
        if (type) query.type = type;
        if (category) query.category = category;
        if (status) query.status = status;
        
        // Amount range filter
        if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = parseFloat(minAmount);
            if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
        }
        
        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDateTime;
            }
        }
        
        // Get transactions with pagination
        const transactions = await Transaction.find(query)
            .select('type amount category status description reference referenceModel createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get total count for pagination
        const total = await Transaction.countDocuments(query);
        
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'All transaction activities retrieved successfully',
            data: {
                transactions,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error fetching transaction activities',
            error: error.message
        });
    }
}
};

module.exports = transactionController;