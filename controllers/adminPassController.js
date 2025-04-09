// controllers/adminPassController.js
const { PassType, HunterPass, PassUsage, PassReset } = require('../models/Pass');
const { getDefaultDisplayName } = require('../utils/passHelper');

const adminPassController = {
    // Create a new pass type
    async createPass(req, res) {
        try {
            const { 
                name, 
                displayName,
                description, 
                effectDuration, 
                boostPercentage,
                availabilityRule,
                stackable,
                active
            } = req.body;
            const adminId = req.admin.id;
    
            // Validate pass name
            if (!['timeExtension', 'cleanSlate', 'booster', 'seasonal'].includes(name)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid pass name. Must be timeExtension, cleanSlate, booster, or seasonal.'
                });
            }
    
            // Validate availability rule
            if (!['monthly', 'bountyWin', 'consecutiveWins', 'seasonTop'].includes(availabilityRule)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid availability rule. Must be monthly, bountyWin, consecutiveWins, or seasonTop.'
                });
            }
    
            // Check if pass type already exists
            const existingPass = await PassType.findOne({ name });
            if (existingPass) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'A pass with this name already exists'
                });
            }
    
            // Create the pass type
            const passType = await PassType.create({
                name,
                displayName: displayName || getDefaultDisplayName(name),
                description,
                effectDuration: effectDuration || (name === 'timeExtension' ? 12 : null),
                boostPercentage: boostPercentage || (name === 'booster' ? 25 : null),
                availabilityRule,
                stackable: stackable !== undefined ? stackable : true,
                active: active !== undefined ? active : true
            });
    
            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Pass type created successfully',
                data: {
                    passType
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating pass type',
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