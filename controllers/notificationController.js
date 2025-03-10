// controllers/notificationController.js
const Notification = require('../models/Notification');

const notificationController = {
    // Create notification (utility function to be used in other controllers)
    async createNotification(hunterData) {
        try {
            const { hunterId, title, message, type, relatedItem, itemModel } = hunterData;
            
            const notification = await Notification.create({
                hunter: hunterId,
                title,
                message,
                type,
                relatedItem,
                itemModel
            });
            
            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    },

    // Get all notifications for a hunter
    async getNotifications(req, res) {
        try {
            const hunterId = req.hunter.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            
            const notifications = await Notification.find({ hunter: hunterId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            
            const total = await Notification.countDocuments({ hunter: hunterId });
            
            return res.status(200).json({
                status: 200,
                success: true,
                data: {
                    notifications,
                    pagination: {
                        total,
                        page,
                        pages: Math.ceil(total / limit),
                        limit
                    }
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching notifications',
                error: error.message
            });
        }
    },

    // Get unread notification count
    async getUnreadCount(req, res) {
        try {
            const hunterId = req.hunter.id;
            
            const count = await Notification.countDocuments({
                hunter: hunterId,
                isRead: false
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                data: { count }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching unread count',
                error: error.message
            });
        }
    },
    
    // Update notification status (mark as read)
    async updateNotificationStatus(req, res) {
        try {
            const { notificationId } = req.params;
            const hunterId = req.hunter.id;
            
            const notification = await Notification.findOneAndUpdate(
                { _id: notificationId, hunter: hunterId },
                { isRead: true },
                { new: true }
            );
            
            if (!notification) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Notification not found or does not belong to you'
                });
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Notification updated successfully',
                data: notification
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating notification',
                error: error.message
            });
        }
    }
};

module.exports = notificationController;



