const Bounty = require('../models/Bounty');
const Lord = require('../models/Lord');

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

    // Review Submission
    async reviewSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;
            const {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation,
                feedback
            } = req.body;
    
            // Validate scores
            const scores = [
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation
            ];
    
            for (const score of scores) {
                if (score < 0 || score > 5 || !Number.isInteger(score)) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Each score must be an integer between 0 and 5'
                    });
                }
            }
    
            // Calculate total score
            const totalScore = scores.reduce((sum, score) => sum + score, 0);
    
            // Check if bounty exists and belongs to the lord
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });
    
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }
    
            // Find participant
            const participantIndex = bounty.participants.findIndex(
                p => p.hunter.toString() === hunterId
            );
    
            if (participantIndex === -1) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found in this bounty'
                });
            }
    
            const participant = bounty.participants[participantIndex];
    
            // Check if participant has submitted
            if (!participant.submission || !participant.submission.submittedAt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter has not submitted any work yet'
                });
            }
    
            // Update the submission with review
            await Bounty.updateOne(
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
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submission reviewed successfully',
                data: {
                    totalScore,
                    scores: {
                        adherenceToBrief,
                        conceptualThinking,
                        technicalExecution,
                        originalityCreativity,
                        documentation
                    }
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
    }
    
};

module.exports = bountyController;