// controllers/foulController.js
const Foul = require('../models/Foul');
const FoulRecord = require('../models/FoulRecord');
const Hunter = require('../models/Hunter');

const foulController = {
    // Create a new foul type
    async createFoul(req, res) {
        try {
            const { name, description, severity } = req.body;
            const adminId = req.admin.id;

            // Validate severity
            if (!['low', 'medium', 'high'].includes(severity)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid severity level. Must be low, medium, or high.'
                });
            }

            // Determine XP penalty percentage based on severity
            let xpPenaltyPercentage;
            switch (severity) {
                case 'low':
                    xpPenaltyPercentage = 5;  // 5% of 2500 = 125 XP
                    break;
                case 'medium':
                    xpPenaltyPercentage = 15; // 15% of 2500 = 375 XP
                    break;
                case 'high':
                    xpPenaltyPercentage = 25; // 25% of 2500 = 625 XP
                    break;
            }

            // Create the foul
            const foul = await Foul.create({
                name,
                description,
                severity,
                xpPenaltyPercentage,
                createdBy: adminId
            });

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Foul created successfully',
                data: {
                    foul,
                    xpPenalty: (xpPenaltyPercentage / 100) * 2500
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating foul',
                error: error.message
            });
        }
    },

    // Get all fouls
    async getAllFouls(req, res) {
        try {
            const fouls = await Foul.find().sort({ severity: -1, createdAt: -1 });

            // Calculate actual XP penalty amounts
            const foulsWithPenalties = fouls.map(foul => ({
                ...foul.toObject(),
                xpPenaltyAmount: (foul.xpPenaltyPercentage / 100) * 2500
            }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Fouls retrieved successfully',
                data: {
                    count: fouls.length,
                    fouls: foulsWithPenalties
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving fouls',
                error: error.message
            });
        }
    },

    // Update a foul
    async updateFoul(req, res) {
        try {
            const { foulId } = req.params;
            const { name, description, active } = req.body;

            // Find the foul
            const foul = await Foul.findById(foulId);
            if (!foul) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Foul not found'
                });
            }

            // Update basic properties only (not severity or penalty)
            const updatedFoul = await Foul.findByIdAndUpdate(
                foulId,
                { name, description, active },
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Foul updated successfully',
                data: {
                    foul: updatedFoul,
                    xpPenaltyAmount: (updatedFoul.xpPenaltyPercentage / 100) * 2500
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating foul',
                error: error.message
            });
        }
    },

    // Apply a foul to a hunter
    async applyFoul(req, res) {
        try {
            const { hunterId, foulId, reason, evidence, relatedBountyId } = req.body;
            const adminId = req.admin.id;

            // Find the hunter
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }

            // Find the foul
            const foul = await Foul.findById(foulId);
            if (!foul) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Foul not found'
                });
            }

            if (!foul.active) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'This foul type is no longer active'
                });
            }

            // Calculate XP penalty
            let xpPenalty = Math.round((foul.xpPenaltyPercentage / 100) * 2500);

            // If this is a "Hunter Quits Bounty" foul, check if bounty is live
            if (foul.name === "Hunter Quits Bounty (Before LIVE)") {
                xpPenalty = 0; // No penalty before live
            }

            // Check if occurrence tracking is needed
            let isStrike = false;
            let occurrenceNumber = 1;

            if (foul.needsOccurrenceTracking) {
                // Find previous occurrences of this foul for this hunter
                const previousOccurrences = await FoulRecord.find({
                    hunter: hunterId,
                    foul: foulId
                }).sort({ appliedAt: 1 });

                occurrenceNumber = previousOccurrences.length + 1;

                // If this is not the first occurrence, it's a strike
                if (occurrenceNumber > 1) {
                    isStrike = true;
                }
            }

            // Create foul record
            const foulRecord = await FoulRecord.create({
                hunter: hunterId,
                foul: foulId,
                reason,
                evidence,
                xpPenalty,
                occurrenceNumber,
                isStrike,
                appliedBy: adminId,
                relatedBounty: relatedBountyId
            });

            // Deduct XP from hunter
            await Hunter.findByIdAndUpdate(
                hunterId,
                {
                    $inc: { xp: -xpPenalty },
                    // If it's a strike, increment strike count
                    ...(isStrike && { $inc: { strikes: 1 } })
                }
            );

            // Fetch updated hunter data
            const updatedHunter = await Hunter.findById(hunterId);

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Foul applied successfully',
                data: {
                    foulRecord,
                    hunterName: hunter.name,
                    foulName: foul.name,
                    severity: foul.severity,
                    xpPenalty,
                    isStrike,
                    occurrenceNumber,
                    newXpTotal: updatedHunter.xp,
                    strikeCount: updatedHunter.strikes || 0
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error applying foul',
                error: error.message
            });
        }
    },

    // Get foul history for a hunter
    async getHunterFoulHistory(req, res) {
        try {
            const { hunterId } = req.params;

            // Check if hunter exists
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }

            // Get foul records
            const foulRecords = await FoulRecord.find({ hunter: hunterId })
                .populate('foul', 'name description severity')
                .populate('appliedBy', 'username')
                .populate('relatedBounty', 'title')
                .sort({ appliedAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter foul history retrieved successfully',
                data: {
                    hunterName: hunter.name,
                    totalFouls: foulRecords.length,
                    totalXpPenalty: foulRecords.reduce((sum, record) => sum + record.xpPenalty, 0),
                    foulRecords
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving foul history',
                error: error.message
            });
        }
    }
};

module.exports = foulController;