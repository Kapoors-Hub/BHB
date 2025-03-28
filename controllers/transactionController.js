// controllers/transactionController.js
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
            const { type, category, startDate, endDate } = req.query;
            
            const result = await transactionService.getTransactionHistory(hunterId, {
                page, 
                limit, 
                type, 
                category, 
                startDate, 
                endDate
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
            
            const walletSummary = await transactionService.getWalletSummary(hunterId);
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Wallet summary retrieved successfully',
                data: walletSummary
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
    }
};

module.exports = transactionController;