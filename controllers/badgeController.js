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
    },

    // Get all badges
    async getAllBadges(req, res) {
        try {
            const badges = await Badge.find().sort({ createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Badges retrieved successfully',
                count: badges.length,
                data: badges
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving badges',
                error: error.message
            });
        }
    },

    // Get badge by ID
    async getBadgeById(req, res) {
        try {
            const { badgeId } = req.params;
            
            const badge = await Badge.findById(badgeId);
            
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
                message: 'Badge retrieved successfully',
                data: badge
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving badge',
                error: error.message
            });
        }
    },
    
    // Get badges earned by a specific hunter
    async getHunterBadges(req, res) {
        try {
            const { hunterId } = req.params;
            
            const hunter = await Hunter.findById(hunterId).populate('badges');
            
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter badges retrieved successfully',
                count: hunter.badges.length,
                data: hunter.badges
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving hunter badges',
                error: error.message
            });
        }
    }
};

module.exports = badgeController;