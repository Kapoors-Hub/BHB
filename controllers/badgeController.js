// controllers/badgeController.js
const Badge = require('../models/Badge');
const Hunter = require('../models/Hunter');

const badgeController = {
    // Create new badge
    async createBadge(req, res) {
        try {
            const { name, description, criteria, icon } = req.body;
            const adminId = req.admin.id;

            const badge = await Badge.create({
                name,
                description,
                criteria,
                icon,
                createdBy: adminId
            });

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Badge created successfully',
                data: badge
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating badge',
                error: error.message
            });
        }
    },

    // Update badge
    async updateBadge(req, res) {
        try {
            const { badgeId } = req.params;
            const { name, description, criteria, icon } = req.body;

            const badge = await Badge.findByIdAndUpdate(
                badgeId,
                { name, description, criteria, icon },
                { new: true }
            );

            if (!badge) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Badge not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Badge updated successfully',
                data: badge
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating badge',
                error: error.message
            });
        }
    }
};

module.exports = badgeController;