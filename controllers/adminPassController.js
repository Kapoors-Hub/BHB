// controllers/adminPassController.js
const Pass = require('../models/Pass');

const adminPassController = {
    // Create a new pass type
    async createPass(req, res) {
        try {
            const { name, passType, description, effectDuration, boostPercentage } = req.body;
            const adminId = req.admin.id;

            // Validate passType
            if (!['timeExtension', 'resetFoul', 'booster', 'seasonal'].includes(passType)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid pass type. Must be timeExtension, resetFoul, booster, or seasonal.'
                });
            }

            // Check if pass already exists
            const existingPass = await Pass.findOne({ name });
            if (existingPass) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'A pass with this name already exists'
                });
            }

            // Create the pass
            const pass = await Pass.create({
                name,
                passType,
                description,
                effectDuration: effectDuration || (passType === 'timeExtension' ? 12 : undefined),
                boostPercentage: boostPercentage || (passType === 'booster' ? 25 : undefined),
                createdBy: adminId
            });

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Pass created successfully',
                data: {
                    pass
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating pass',
                error: error.message
            });
        }
    },

    // Get all passes
    async getAllPasses(req, res) {
        try {
            const passes = await Pass.find().sort({ passType: 1, createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Passes retrieved successfully',
                data: {
                    count: passes.length,
                    passes
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving passes',
                error: error.message
            });
        }
    },

    // Update a pass
    async updatePass(req, res) {
        try {
            const { passId } = req.params;
            const { name, description, effectDuration, boostPercentage, active } = req.body;

            // Find the pass
            const pass = await Pass.findById(passId);
            if (!pass) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Pass not found'
                });
            }

            // Update the pass
            pass.name = name || pass.name;
            pass.description = description || pass.description;
            
            if (effectDuration !== undefined) {
                pass.effectDuration = effectDuration;
            }
            
            if (boostPercentage !== undefined) {
                pass.boostPercentage = boostPercentage;
            }
            
            if (active !== undefined) {
                pass.active = active;
            }

            await pass.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Pass updated successfully',
                data: {
                    pass
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating pass',
                error: error.message
            });
        }
    },

    // Get pass by ID
    async getPassById(req, res) {
        try {
            const { passId } = req.params;

            const pass = await Pass.findById(passId);
            if (!pass) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Pass not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Pass retrieved successfully',
                data: {
                    pass
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving pass',
                error: error.message
            });
        }
    }
};

module.exports = adminPassController;