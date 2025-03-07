// controllers/passController.js
const Hunter = require('../models/Hunter');
const Pass = require('../models/Pass');
const FoulRecord = require('../models/FoulRecord');
const Bounty = require('../models/Bounty');

const passController = {
    // Get hunter's passes
    async getHunterPasses(req, res) {
        try {
            const hunterId = req.hunter.id;
            
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
            
            // Get pass usage history
            const passHistory = await Pass.find({ hunter: hunterId })
                .populate('relatedBounty', 'title')
                .populate('relatedFoul', 'name')
                .sort({ usedAt: -1 });
                
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Passes retrieved successfully',
                data: {
                    availablePasses: {
                        timeExtension: hunter.passes.timeExtension.count,
                        resetFoul: hunter.passes.resetFoul.count,
                        booster: hunter.passes.booster.count,
                        seasonal: hunter.passes.seasonal.count
                    },
                    consecutiveWins: hunter.passes.consecutiveWins,
                    passHistory
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
    
    // Use time extension pass
    async useTimeExtensionPass(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
            
            // Check if hunter has a time extension pass
            if (hunter.passes.timeExtension.count <= 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'No time extension passes available'
                });
            }
            
            // Check if hunter is participating in the bounty
            const bounty = await Bounty.findOne({
                _id: bountyId,
                'participants.hunter': hunterId
            });
            
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you are not a participant'
                });
            }
            
            // Check if bounty is active
            if (bounty.status !== 'active') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Time extension can only be used for active bounties'
                });
            }
            
            // Use the pass
            await Hunter.findByIdAndUpdate(hunterId, {
                $inc: { 'passes.timeExtension.count': -1 }
            });
            
            // Create pass usage record
            const effectUntil = new Date(bounty.endTime);
            effectUntil.setHours(effectUntil.getHours() + 24); // 24-hour extension
            
            const passRecord = await Pass.create({
                hunter: hunterId,
                passType: 'timeExtension',
                relatedBounty: bountyId,
                status: 'active',
                effectUntil
            });
            
            // Update bounty for this hunter to extend deadline
            await Bounty.findOneAndUpdate(
                { 
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.extendedEndTime': effectUntil
                    }
                }
            );
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Time extension pass used successfully',
                data: {
                    bountyTitle: bounty.title,
                    extendedUntil: effectUntil,
                    remainingPasses: hunter.passes.timeExtension.count - 1
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error using time extension pass',
                error: error.message
            });
        }
    },
    
    // Use reset foul pass
    async useResetFoulPass(req, res) {
        try {
            const { foulRecordId } = req.params;
            const hunterId = req.hunter.id;
            
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
            
            // Check if hunter has a reset foul pass
            if (hunter.passes.resetFoul.count <= 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'No reset foul passes available'
                });
            }
            
            // Check if foul record exists and belongs to hunter
            const foulRecord = await FoulRecord.findOne({
                _id: foulRecordId,
                hunter: hunterId
            }).populate('foul', 'name xpPenaltyPercentage');
            
            if (!foulRecord) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Foul record not found or does not belong to you'
                });
            }
            
            // Use the pass
            await Hunter.findByIdAndUpdate(hunterId, {
                $inc: { 
                    'passes.resetFoul.count': -1,
                    'xp': foulRecord.xpPenalty // Restore the XP that was deducted
                }
            });
            
            // Mark foul as reset
            await FoulRecord.findByIdAndUpdate(foulRecordId, {
                $set: {
                    reset: true,
                    resetDate: new Date()
                }
            });
            
            // Create pass usage record
            const passRecord = await Pass.create({
                hunter: hunterId,
                passType: 'resetFoul',
                relatedFoul: foulRecordId,
                status: 'completed'
            });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Foul reset pass used successfully',
                data: {
                    foulName: foulRecord.foul.name,
                    xpRestored: foulRecord.xpPenalty,
                    remainingPasses: hunter.passes.resetFoul.count - 1
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error using reset foul pass',
                error: error.message
            });
        }
    },
    
    // Use booster pass
    async useBoosterPass(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
            
            // Check if hunter has a booster pass
            if (hunter.passes.booster.count <= 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'No booster passes available'
                });
            }
            
            // Check if hunter is participating in the bounty
            const bounty = await Bounty.findOne({
                _id: bountyId,
                'participants.hunter': hunterId
            });
            
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you are not a participant'
                });
            }
            
            // Check if bounty is active (can only use before completion)
            if (bounty.status !== 'active') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Booster pass can only be used for active bounties'
                });
            }
            
            // Use the pass
            await Hunter.findByIdAndUpdate(hunterId, {
                $inc: { 'passes.booster.count': -1 }
            });
            
            // Create pass usage record
            const passRecord = await Pass.create({
                hunter: hunterId,
                passType: 'booster',
                relatedBounty: bountyId,
                status: 'active'
            });
            
            // Update bounty participant to mark booster active
            await Bounty.findOneAndUpdate(
                { 
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.boosterActive': true
                    }
                }
            );
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Booster pass activated successfully',
                data: {
                    bountyTitle: bounty.title,
                    xpBoostPercentage: 25, // 125% of normal XP
                    remainingPasses: hunter.passes.booster.count - 1
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error using booster pass',
                error: error.message
            });
        }
    },
    
    // Award passes based on bounty results
    async awardPassesForBounty(bountyId) {
        try {
            const bounty = await Bounty.findById(bountyId)
                .populate('participants.hunter');
                
            if (!bounty || bounty.status !== 'completed') {
                return;
            }
            
            // Get all reviewed submissions
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission && p.submission.review
            );
            
            // Sort by score
            const sortedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );
            
            // Award Reset Foul pass to the winner
            if (sortedParticipants.length > 0) {
                const winner = sortedParticipants[0];
                
                // Update winner's consecutive wins and award passes
                const hunter = await Hunter.findById(winner.hunter._id);
                
                // Increment consecutive wins
                const newConsecutiveWins = hunter.passes.consecutiveWins + 1;
                
                // Update passes
                await Hunter.findByIdAndUpdate(winner.hunter._id, {
                    $inc: { 
                        'passes.resetFoul.count': 1, // Award 1 Reset Foul pass for winning
                        'passes.consecutiveWins': 1
                    }
                });
                
                // If they now have 2 consecutive wins, award a Booster pass
                if (newConsecutiveWins >= 2) {
                    await Hunter.findByIdAndUpdate(winner.hunter._id, {
                        $inc: { 'passes.booster.count': 1 }, // Award 1 Booster pass
                        $set: { 'passes.consecutiveWins': 0 } // Reset consecutive wins counter
                    });
                }
            }
        } catch (error) {
            console.error('Error awarding passes for bounty:', error);
        }
    },
    
    // Monthly reset for time extension passes
    async resetMonthlyPasses() {
        try {
            const currentDate = new Date();
            const lastMonth = new Date(currentDate);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            
            // Find hunters whose passes haven't been reset this month
            const hunters = await Hunter.find({
                'passes.timeExtension.lastResetDate': { $lt: lastMonth }
            });
            
            // Reset time extension passes
            for (const hunter of hunters) {
                await Hunter.findByIdAndUpdate(hunter._id, {
                    $inc: { 'passes.timeExtension.count': 1 }, // Add one pass
                    $set: { 'passes.timeExtension.lastResetDate': currentDate }
                });
            }
            
            console.log(`Reset monthly passes for ${hunters.length} hunters`);
        } catch (error) {
            console.error('Error resetting monthly passes:', error);
        }
    },
    
    // Award seasonal passes to top performers
    async awardSeasonalPasses(req, res) {
        try {
            const { topHunterIds } = req.body;
            const adminId = req.admin.id;
            
            if (!Array.isArray(topHunterIds) || topHunterIds.length === 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Top hunter IDs must be a non-empty array'
                });
            }
            
            // Award seasonal passes to top hunters
            const updatedHunters = [];
            
            for (const hunterId of topHunterIds) {
                const hunter = await Hunter.findById(hunterId);
                
                if (hunter) {
                    // Award one of each pass
                    await Hunter.findByIdAndUpdate(hunterId, {
                        $inc: { 
                            'passes.timeExtension.count': 1,
                            'passes.resetFoul.count': 1,
                            'passes.booster.count': 1,
                            'passes.seasonal.count': 1
                        },
                        $set: { 'passes.seasonal.lastAwarded': new Date() }
                    });
                    
                    updatedHunters.push({
                        id: hunter._id,
                        name: hunter.name,
                        username: hunter.username
                    });
                }
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Seasonal passes awarded successfully',
                data: {
                    awardedTo: updatedHunters
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error awarding seasonal passes',
                error: error.message
            });
        }
    }
};

module.exports = passController;