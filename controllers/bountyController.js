const Bounty = require('../models/Bounty');
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');

const bountyController = {
    // Create new bounty
    async createBounty(req, res) {
        try {
            const {
                title,
                context,
                deliverables,
                challenge,
                startTime,
                endTime,
                resultTime,
                doubtSessionTime,
                doubtSessionDate,
                doubtSessionLink,
                rewardPrize,
                maxHunters
            } = req.body;

            // Validate dates
            const currentDate = new Date();
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            const resultDate = new Date(resultTime);
            const doubtDate = new Date(doubtSessionDate);

            if (startDate < currentDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Start time cannot be in the past'
                });
            }

            if (endDate <= startDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'End time must be after start time'
                });
            }

            if (resultDate <= endDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Result time must be after end time'
                });
            }

            // Set initial status based on start time
            const initialStatus = currentDate >= startDate ? 'active' : 'draft';

            const bounty = await Bounty.create({
                title,
                context,
                deliverables,
                challenge,
                startTime,
                endTime,
                resultTime,
                doubtSessionTime,
                doubtSessionDate,
                doubtSessionLink,
                rewardPrize,
                maxHunters,
                status: initialStatus,
                createdBy: req.lord.id
            });

            await Lord.findByIdAndUpdate(
                req.lord.id,
                { $push: { bounties: bounty._id } },
                { new: true }
            );

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Bounty created successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating bounty',
                error: error.message
            });
        }
    },

    // Get all bounties created by a lord
    async getLordBounties(req, res) {
        try {
            const bounties = await Bounty.find({ createdBy: req.lord.id })
                .sort({ createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounties fetched successfully',
                data: bounties
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounties',
                error: error.message
            });
        }
    },

    // Get single bounty
    async getBountyById(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to access this bounty'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty fetched successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounty',
                error: error.message
            });
        }
    },

    // Update bounty
    async updateBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to update this bounty'
                });
            }

            // Don't allow updates if bounty is active or completed
            if (bounty.status !== 'draft') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot update bounty after it becomes active'
                });
            }

            const updatedBounty = await Bounty.findByIdAndUpdate(
                req.params.bountyId,
                req.body,
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty updated successfully',
                data: updatedBounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating bounty',
                error: error.message
            });
        }
    },

    // Delete bounty
    async deleteBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to delete this bounty'
                });
            }

            if (bounty.status !== 'draft') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot delete active or completed bounty'
                });
            }

            await Lord.findByIdAndUpdate(
                req.lord.id,
                { $pull: { bounties: bounty._id } }
            );

            await Bounty.findByIdAndDelete(req.params.bountyId);

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting bounty',
                error: error.message
            });
        }
    },

    // Get bounty submissions
    async getBountySubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate('participants.hunter', 'username name email');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Filter only participants who have submitted
            const submissions = bounty.participants.filter(
                participant => participant.submission && participant.submission.submittedAt
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    totalSubmissions: submissions.length,
                    submissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving submissions',
                error: error.message
            });
        }
    },

    // Get a specific hunter's submission for a bounty
async getHunterSubmission(req, res) {
    try {
        const { bountyId, hunterId } = req.params;
        const lordId = req.lord.id;

        // Find the bounty and verify ownership
        const bounty = await Bounty.findOne({
            _id: bountyId,
            createdBy: lordId
        }).populate('participants.hunter', 'username name email');

        if (!bounty) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Bounty not found or you do not have permission'
            });
        }

        // Find the participant
        const participant = bounty.participants.find(
            p => p.hunter._id.toString() === hunterId
        );

        if (!participant) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found in this bounty'
            });
        }

        if (!participant.submission) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter has not submitted any work yet'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Hunter submission retrieved successfully',
            data: {
                bountyTitle: bounty.title,
                hunter: {
                    id: participant.hunter._id,
                    name: participant.hunter.name,
                    username: participant.hunter.username,
                    email: participant.hunter.email
                },
                submission: participant.submission,
                submittedAt: participant.submission.submittedAt,
                reviewed: !!participant.submission.review,
                joinedAt: participant.joinedAt
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error retrieving hunter submission',
            error: error.message
        });
    }
},

    // Review Submission
    async reviewSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;
    
            // Check if result date has passed
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate('participants.hunter');
    
            const currentDate = new Date();
            if (currentDate > bounty.resultTime) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot review after result date has passed'
                });
            }
    
            // Calculate total score
            const totalScore = scores.reduce((sum, score) => sum + score, 0);
    
            // Update submission with review
            await Bounty.findOneAndUpdate(
                { 
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.submission.review': {
                            adherenceToBrief,
                            conceptualThinking,
                            technicalExecution,
                            originalityCreativity,
                            documentation,
                            totalScore,
                            feedback,
                            reviewedAt: new Date(),
                            reviewedBy: lordId
                        }
                    }
                }
            );
    
            // Get all reviewed submissions and determine current winner
            const updatedBounty = await Bounty.findById(bountyId)
                .populate('participants.hunter');
    
            const reviewedParticipants = updatedBounty.participants.filter(
                p => p.submission && p.submission.review
            );
    
            // Sort reviewed participants by score
            const sortedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );
    
            // Current leader is the highest scored among reviewed submissions
            const currentLeader = sortedParticipants[0];
            const lastPlace = sortedParticipants[sortedParticipants.length - 1];
    
            // Update achievements only if it's the current leader
            if (currentLeader && currentLeader.hunter._id.toString() === hunterId) {
                await Hunter.findByIdAndUpdate(
                    hunterId,
                    {
                        $inc: { 'achievements.bountiesWon.count': 1 },
                        $push: { 'achievements.bountiesWon.bountyIds': bountyId }
                    }
                );
                await checkAndAwardBadges(hunterId);
            }
    
            // Update last place achievement
            if (lastPlace && lastPlace.hunter._id.toString() === hunterId) {
                await Hunter.findByIdAndUpdate(
                    lastPlace.hunter._id,
                    {
                        $inc: { 'achievements.lastPlaceFinishes.count': 1 },
                        $push: { 'achievements.lastPlaceFinishes.bountyIds': bountyId }
                    }
                );
                await checkAndAwardBadges(lastPlace.hunter._id);
            }
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submission reviewed successfully',
                data: {
                    totalScore,
                    reviewedCount: reviewedParticipants.length,
                    totalParticipants: bounty.participants.length,
                    currentLeader: {
                        hunter: currentLeader.hunter.username,
                        score: currentLeader.submission.review.totalScore
                    },
                    isCurrentLeader: currentLeader.hunter._id.toString() === hunterId
                }
            });
    
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error reviewing submission',
                error: error.message
            });
        }
    },

    async postBountyResult(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;
    
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate('participants.hunter');
    
            // Check if result date has reached
            const currentDate = new Date();
            if (currentDate < bounty.resultTime) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot post result before result date'
                });
            }
    
            // Get reviewed submissions
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission && p.submission.review
            );
    
            // Sort by score
            const sortedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );
    
            // Update bounty status to completed
            bounty.status = 'completed';
            await bounty.save();
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty result posted successfully',
                data: {
                    bountyTitle: bounty.title,
                    totalParticipants: bounty.participants.length,
                    reviewedParticipants: reviewedParticipants.length,
                    rankings: sortedParticipants.map((p, index) => ({
                        rank: index + 1,
                        hunter: p.hunter.username,
                        score: p.submission.review.totalScore
                    }))
                }
            });
    
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error posting result',
                error: error.message
            });
        }
    }

};

module.exports = bountyController;