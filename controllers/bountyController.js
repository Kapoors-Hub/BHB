const Bounty = require('../models/Bounty');
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');
const { checkAndAwardBadges } = require('../services/badgeService');
const { calculateReviewXP, updateHunterXP } = require('../services/xpService');
const passController = require("./passController");
const performanceCalculator = require('../utils/performanceCalculator');
const notificationController = require('./notificationController');
const transactionService = require('../services/transactionService');
const Foul = require('../models/Foul');
const FoulRecord = require('../models/FoulRecord');
const BountyResult = require('../models/BountyResult');
const notificationService = require('../services/notificationService');

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
                maxHunters,
                assets,
                assetsDescription
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
            const initialStatus = currentDate >= startDate ? 'active' : 'yts';

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
                assets,
                assetsDescription,
                status: initialStatus,
                createdBy: req.lord.id
            });

            await Lord.findByIdAndUpdate(
                req.lord.id,
                { $push: { bounties: bounty._id } },
                { new: true }
            );

            const lord = await Lord.findById(req.lord.id);

            notificationService.sendNewBountyNotification(bounty, lord)
            .catch(err => console.error('Error in notification sending:', err));

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
    // async getHunterSubmission(req, res) {
    //     try {
    //         const { bountyId, hunterId } = req.params;
    //         const lordId = req.lord.id;

    //         // Find the bounty and verify ownership
    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             createdBy: lordId
    //         }).populate('participants.hunter', 'username name email');

    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found or you do not have permission'
    //             });
    //         }

    //         // Find the participant
    //         const participant = bounty.participants.find(
    //             p => p.hunter._id.toString() === hunterId
    //         );


    //         if (!participant) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found in this bounty'
    //             });
    //         }

    //         if (!participant.submission) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter has not submitted any work yet'
    //             });
    //         }

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Hunter submission retrieved successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 hunter: {
    //                     id: participant.hunter._id,
    //                     name: participant.hunter.name,
    //                     username: participant.hunter.username,
    //                     email: participant.hunter.email
    //                 },
    //                 submission: participant.submission,
    //                 submittedAt: participant.submission.submittedAt,
    //                 reviewed: !!participant.submission.review,
    //                 joinedAt: participant.joinedAt
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error retrieving hunter submission',
    //             error: error.message
    //         });
    //     }
    // },

    // Review Submission

    // async reviewSubmission(req, res) {
    //         try {
    //             const { bountyId, hunterId } = req.params;
    //             const lordId = req.lord.id;
    //             const {
    //                 adherenceToBrief,
    //                 conceptualThinking,
    //                 technicalExecution,
    //                 originalityCreativity,
    //                 documentation,
    //                 feedback
    //             } = req.body;

    //             // Validate that all scores are provided
    //             const scores = [
    //                 adherenceToBrief,
    //                 conceptualThinking,
    //                 technicalExecution,
    //                 originalityCreativity,
    //                 documentation
    //             ];

    //             if (scores.some(score => score === undefined || score < 0 || score > 5)) {
    //                 return res.status(400).json({
    //                     status: 400,
    //                     success: false,
    //                     message: 'All scores must be provided and be between 0 and 5'
    //                 });
    //             }

    //             // Check if result date has passed
    //             const bounty = await Bounty.findOne({
    //                 _id: bountyId,
    //                 createdBy: lordId
    //             }).populate('participants.hunter');

    //             const currentDate = new Date();
    //             if (currentDate > bounty.resultTime) {
    //                 return res.status(400).json({
    //                     status: 400,
    //                     success: false,
    //                     message: 'Cannot review after result date has passed'
    //                 });
    //             }

    //             // Calculate total score
    //             const totalScore = scores.reduce((sum, score) => sum + score, 0);

    //             // Update submission with review
    //             await Bounty.findOneAndUpdate(
    //                 {
    //                     _id: bountyId,
    //                     'participants.hunter': hunterId
    //                 },
    //                 {
    //                     $set: {
    //                         'participants.$.submission.review': {
    //                             adherenceToBrief,
    //                             conceptualThinking,
    //                             technicalExecution,
    //                             originalityCreativity,
    //                             documentation,
    //                             totalScore,
    //                             feedback,
    //                             reviewedAt: new Date(),
    //                             reviewedBy: lordId
    //                         }
    //                     }
    //                 }
    //             );

    //             // Get all reviewed submissions and determine current winner
    //             const updatedBounty = await Bounty.findById(bountyId)
    //                 .populate('participants.hunter');

    //             const reviewedParticipants = updatedBounty.participants.filter(
    //                 p => p.submission && p.submission.review
    //             );

    //             // Sort reviewed participants by score
    //             const sortedParticipants = reviewedParticipants.sort(
    //                 (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
    //             );

    //             // Current leader is the highest scored among reviewed submissions
    //             const currentLeader = sortedParticipants[0];
    //             const lastPlace = sortedParticipants[sortedParticipants.length - 1];

    //             // Update achievements only if it's the current leader
    //             if (currentLeader && currentLeader.hunter._id.toString() === hunterId) {
    //                 await Hunter.findByIdAndUpdate(
    //                     hunterId,
    //                     {
    //                         $inc: { 'achievements.bountiesWon.count': 1 },
    //                         $push: { 'achievements.bountiesWon.bountyIds': bountyId }
    //                     }
    //                 );
    //                 // Placeholder for badge service
    //                 await checkAndAwardBadges(hunterId);
    //             }

    //             // Update last place achievement
    //             if (lastPlace && lastPlace.hunter._id.toString() === hunterId) {
    //                 await Hunter.findByIdAndUpdate(
    //                     lastPlace.hunter._id,
    //                     {
    //                         $inc: { 'achievements.lastPlaceFinishes.count': 1 },
    //                         $push: { 'achievements.lastPlaceFinishes.bountyIds': bountyId }
    //                     }
    //                 );
    //                 // Placeholder for badge service
    //                 await checkAndAwardBadges(lastPlace.hunter._id);
    //             }

    //             // Calculate XP change using XP service
    //             const xpChange = calculateReviewXP(scores);

    //             // Update hunter's XP using XP service
    //             const newTotalXp = await updateHunterXP(hunterId, xpChange);

    //             // Add hunter to evaluated list
    //             if (!bounty.evaluatedHunters.includes(hunterId)) {
    //                 bounty.evaluatedHunters.push(hunterId);
    //                 await bounty.save();
    //             }

    //             return res.status(200).json({
    //                 status: 200,
    //                 success: true,
    //                 message: 'Submission reviewed successfully',
    //                 data: {
    //                     totalScore,
    //                     reviewedCount: reviewedParticipants.length,
    //                     totalParticipants: bounty.participants.length,
    //                     currentLeader: {
    //                         hunter: currentLeader.hunter.username,
    //                         score: currentLeader.submission.review.totalScore
    //                     },
    //                     isCurrentLeader: currentLeader.hunter._id.toString() === hunterId,
    //                     xpChange: xpChange,
    //                     newTotalXp: newTotalXp
    //                 }
    //             });

    //         } catch (error) {
    //             return res.status(500).json({
    //                 status: 500,
    //                 success: false,
    //                 message: 'Error reviewing submission',
    //                 error: error.message
    //             });
    //         }
    //     },

    // async postBountyResult(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const lordId = req.lord.id;

    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             createdBy: lordId
    //         }).populate('participants.hunter');

    //         // Check if result date has reached
    //         const currentDate = new Date();
    //         if (currentDate < bounty.resultTime) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Cannot post result before result date'
    //             });
    //         }

    //         // Get reviewed submissions
    //         const reviewedParticipants = bounty.participants.filter(
    //             p => p.submission && p.submission.review
    //         );

    //         // Sort by score
    //         const sortedParticipants = reviewedParticipants.sort(
    //             (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
    //         );

    //         // Calculate performance scores for each participant
    //         const performanceResults = [];
    //         for (let i = 0; i < sortedParticipants.length; i++) {
    //             const participant = sortedParticipants[i];
    //             const rank = i + 1; // 1-based ranking

    //             try {
    //                 const performanceResult = await performanceCalculator.calculatePerformanceScore(
    //                     participant.hunter._id.toString(),
    //                     bountyId,
    //                     rank
    //                 );

    //                 if (performanceResult) {
    //                     performanceResults.push({
    //                         hunterId: participant.hunter._id,
    //                         hunterUsername: participant.hunter.username,
    //                         performanceScore: performanceResult.bountyScore,
    //                         overallScore: performanceResult.overallScore
    //                     });
    //                 }
    //             } catch (perfError) {
    //                 console.error(`Error calculating performance for hunter ${participant.hunter._id}:`, perfError);
    //                 // Continue with other hunters even if one fails
    //             }
    //         }

    //         // Update bounty status to completed
    //         bounty.status = 'completed';
    //         await passController.awardPassesForBounty(bountyId);
    //         await bounty.save();

    //         // Send notifications to all participants about results
    //         for (const participant of sortedParticipants) {
    //             try {
    //                 const rank = sortedParticipants.findIndex(p => p.hunter._id.toString() === participant.hunter._id.toString()) + 1;

    //                 await notificationController.createNotification({
    //                     hunterId: participant.hunter._id,
    //                     title: 'Bounty Results Published',
    //                     message: `Results for "${bounty.title}" are now available. You ranked #${rank} out of ${sortedParticipants.length} hunters.`,
    //                     type: 'bounty',
    //                     relatedItem: bountyId,
    //                     itemModel: 'Bounty'
    //                 });
    //             } catch (notifyError) {
    //                 console.error(`Error sending notification to hunter ${participant.hunter._id}:`, notifyError);
    //             }
    //         }

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Bounty result posted successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 totalParticipants: bounty.participants.length,
    //                 reviewedParticipants: reviewedParticipants.length,
    //                 rankings: sortedParticipants.map((p, index) => ({
    //                     rank: index + 1,
    //                     hunter: p.hunter.username,
    //                     score: p.submission.review.totalScore,
    //                     performanceScore: performanceResults.find(r => r.hunterId.toString() === p.hunter._id.toString())?.performanceScore || null
    //                 }))
    //             }
    //         });

    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error posting result',
    //             error: error.message
    //         });
    //     }
    // },

    // 1. First, let's modify the reviewSubmission controller to mark reviews as "draft" by default

    // Update in bountyController.js
    async reviewSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation,
                feedback
            } = req.body;

            const lordId = req.lord.id;

            // Find the bounty
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you are not authorized'
                });
            }

            // Find the participant
            const participantIndex = bounty.participants.findIndex(
                p => p.hunter.toString() === hunterId
            );

            if (participantIndex === -1) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter is not a participant in this bounty'
                });
            }

            // Check if submission exists
            if (!bounty.participants[participantIndex].submission ||
                !bounty.participants[participantIndex].submission.submittedAt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter has not submitted any work'
                });
            }

            // Calculate total score
            const totalScore =
                adherenceToBrief +
                conceptualThinking +
                technicalExecution +
                originalityCreativity +
                documentation;

            // Update the submission with review
            bounty.participants[participantIndex].submission.review = {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation,
                totalScore,
                feedback,
                reviewedAt: new Date(),
                reviewedBy: lordId,
                reviewStatus: 'draft' // Set as draft initially
            };

            // Add to evaluatedHunters list if not already there
            if (!bounty.evaluatedHunters.includes(hunterId)) {
                bounty.evaluatedHunters.push(hunterId);
            }

            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submission reviewed successfully',
                data: {
                    hunterName: bounty.participants[participantIndex].hunter.name || 'Hunter',
                    totalScore,
                    reviewStatus: 'draft'
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

    // Post Bounty

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
    
    
            // Get reviewed submissions with stricter validation
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission &&
                    p.submission.submittedAt &&
                    p.submission.review &&
                    typeof p.submission.review.totalScore === 'number' &&
                    p.submission.review.totalScore >= 0
            );
    
    
    
            if (reviewedParticipants.length === 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'No submissions have been reviewed yet'
                });
            }
    
            // Identify hunters who registered but did not submit
            const nonSubmittingParticipants = bounty.participants.filter(
                p => !p.submission || !p.submission.submittedAt
            );
    
            // Apply fouls to non-submitting participants
            for (const participant of nonSubmittingParticipants) {
                // Find the appropriate foul type
                const noSubmissionFoul = await Foul.findOne({ name: "Registers but does not submit" });
    
                if (noSubmissionFoul) {
                    // Find if this hunter has previous occurrences of this foul
                    const previousOccurrences = await FoulRecord.find({
                        hunter: participant.hunter._id,
                        foul: noSubmissionFoul._id
                    });
    
                    // Determine if this is a strike (second or later occurrence)
                    const isStrike = previousOccurrences.length > 0;
                    const occurrenceNumber = previousOccurrences.length + 1;
    
                    // Calculate XP penalty (625 XP)
                    const xpPenalty = 625;
    
                    // Create foul record
                    await FoulRecord.create({
                        hunter: participant.hunter._id,
                        foul: noSubmissionFoul._id,
                        reason: `Registered for bounty "${bounty.title}" but did not submit work`,
                        evidence: `Bounty ID: ${bountyId}`,
                        xpPenalty,
                        occurrenceNumber,
                        isStrike,
                        appliedBy: lordId, // Or you could use an admin ID if available
                        relatedBounty: bountyId
                    });
    
                    // Update hunter's XP and strike count if applicable
                    if (isStrike) {
                        await Hunter.findByIdAndUpdate(
                            participant.hunter._id,
                            {
                                $inc: {
                                    xp: -xpPenalty,
                                    'strikes.count': 1
                                }
                            }
                        );
    
                        // Get updated hunter data to check tier after XP deduction
                        const updatedHunter = await Hunter.findById(participant.hunter._id);
                        
                        // Check and update level tier if needed
                        updatedHunter.updateLevel();
                        await updatedHunter.save();
    
                        // Check if this pushes hunter to 3 strikes (suspension threshold)
                        if (updatedHunter.strikes.count >= 3) {
                            // Calculate suspension period (14 days from now)
                            const suspensionStartDate = new Date();
                            const suspensionEndDate = new Date();
                            suspensionEndDate.setDate(suspensionEndDate.getDate() + 14);
    
                            // Update hunter with suspension
                            await Hunter.findByIdAndUpdate(
                                participant.hunter._id,
                                {
                                    $set: {
                                        'strikes.isCurrentlySuspended': true,
                                        'strikes.suspensionEndDate': suspensionEndDate
                                    },
                                    $push: {
                                        'strikes.suspensionHistory': {
                                            startDate: suspensionStartDate,
                                            endDate: suspensionEndDate,
                                            reason: `Accumulated 3 strikes. Latest foul: No submission for bounty "${bounty.title}"`
                                        }
                                    }
                                }
                            );
    
                            // Create notification for suspension
                            await notificationController.createNotification({
                                hunterId: participant.hunter._id,
                                title: 'Account Suspended',
                                message: `Your account has been suspended for 14 days due to accumulating 3 strikes. You will be able to return on ${suspensionEndDate.toLocaleDateString()}.`,
                                type: 'system'
                            });
                        }
                    } else {
                        // Just deduct XP for first occurrence
                        const updatedHunter = await Hunter.findByIdAndUpdate(
                            participant.hunter._id,
                            { $inc: { xp: -xpPenalty } },
                            { new: true } // Return the updated document
                        );
                        
                        // Check and update level tier if needed
                        updatedHunter.updateLevel();
                        await updatedHunter.save();
                    }
    
                    // Create notification for hunter
                    await notificationController.createNotification({
                        hunterId: participant.hunter._id,
                        title: 'Foul Received',
                        message: `You have received a foul for registering but not submitting work for bounty "${bounty.title}". This has resulted in a penalty of ${xpPenalty} XP.${isStrike ? ' This foul counts as a strike.' : ''}`,
                        type: 'system'
                    });
                }
            }
    
            // Sort by score
            const sortedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );
    
            // Check if this is a non-profit bounty (reward prize is zero)
            if (bounty.rewardPrize === 0) {
                // Update nonProfitBounties count for all submitters
                for (const participant of reviewedParticipants) {
                    await Hunter.findByIdAndUpdate(
                        participant.hunter._id,
                        {
                            $inc: { 'achievements.nonProfitBounties.count': 1 },
                            $push: { 'achievements.nonProfitBounties.bountyIds': bountyId }
                        }
                    );
    
                    // Create a notification for the hunter
                    await notificationController.createNotification({
                        hunterId: participant.hunter._id,
                        title: 'Non-Profit Bounty Completed',
                        message: `You've completed a non-profit bounty: "${bounty.title}". Thank you for your contribution!`,
                        type: 'achievement',
                        relatedItem: bountyId,
                        itemModel: 'Bounty'
                    });
                }
    
                console.log(`Updated nonProfitBounties count for ${reviewedParticipants.length} hunters`);
            }
    
            // Update bounty status to completed
            bounty.status = 'completed';
    
            // Now update each hunter's profile based on their performance
            for (let i = 0; i < sortedParticipants.length; i++) {
                const participant = sortedParticipants[i];
                const hunter = participant.hunter;
                const rank = i + 1;
    
                // Calculate XP earned based on review scores
                const scores = [
                    participant.submission.review.adherenceToBrief,
                    participant.submission.review.conceptualThinking,
                    participant.submission.review.technicalExecution,
                    participant.submission.review.originalityCreativity,
                    participant.submission.review.documentation
                ];
    
                // Calculate XP using XP service
                const xpService = require('../services/xpService');
                const xpEarned = xpService.calculateReviewXP(scores);
    
                // Update hunter's XP
                const updatedHunter = await Hunter.findByIdAndUpdate(
                    hunter._id,
                    { $inc: { xp: xpEarned } },
                    { new: true } // Return the updated document
                );
                
                // Check and update level tier if needed
                updatedHunter.updateLevel();
                await updatedHunter.save();
                
                // Store original tier and rank for notification
                const originalTier = hunter.level.tier;
                const originalRank = hunter.level.rank;
                const newTier = updatedHunter.level.tier;
                const newRank = updatedHunter.level.rank;
                
                // Send notification if tier or rank changed
                if (originalTier !== newTier || originalRank !== newRank) {
                    await notificationController.createNotification({
                        hunterId: hunter._id,
                        title: 'Level Up!',
                        message: `Congratulations! You've leveled up to ${newTier} ${newRank} after completing the bounty "${bounty.title}".`,
                        type: 'achievement'
                    });
                }
    
                // Update hunter's achievements based on performance
                if (rank === 1) {
                    // Winner
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        {
                            $inc: { 'achievements.bountiesWon.count': 1 },
                            $push: { 'achievements.bountiesWon.bountyIds': bountyId }
                        }
                    );
    
                    // Give a resetFoul pass to the winner
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        { $inc: { 'passes.resetFoul.count': 1 } }
                    );
    
                    // Increment consecutive wins for booster pass
                    const updatedHunterWins = await Hunter.findByIdAndUpdate(
                        hunter._id,
                        { $inc: { 'passes.consecutiveWins': 1 } },
                        { new: true }
                    );
    
                    // If they reached 2 consecutive wins, give a booster pass
                    if (updatedHunterWins.passes.consecutiveWins >= 2) {
                        await Hunter.findByIdAndUpdate(
                            hunter._id,
                            {
                                $inc: { 'passes.booster.count': 1 },
                                $set: { 'passes.consecutiveWins': 0 } // Reset counter
                            }
                        );
                    }
                } else {
                    // Not winner, reset consecutive wins
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        { $set: { 'passes.consecutiveWins': 0 } }
                    );
    
                    // If last place
                    if (rank === sortedParticipants.length) {
                        await Hunter.findByIdAndUpdate(
                            hunter._id,
                            {
                                $inc: { 'achievements.lastPlaceFinishes.count': 1 },
                                $push: { 'achievements.lastPlaceFinishes.bountyIds': bountyId }
                            }
                        );
                    }
                }
    
                // Calculate and update performance score
                if (bounty.participants.length > 1) {  // Only if competitive
                    const performanceCalculator = require('../utils/performanceCalculator');
                    await performanceCalculator.calculatePerformanceScore(
                        hunter._id.toString(),
                        bountyId,
                        rank,
                        xpEarned
                    );
                }
    
                // Create wallet transaction for winner
                if (rank === 1 && bounty.rewardPrize > 0) {
                    // Add the prize money to the winner's wallet
                    // Update total earnings separately
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        { $inc: { totalEarnings: bounty.rewardPrize } }
                    );
                    console.log(`Updated totalEarnings for hunter ${hunter._id} with amount ${bounty.rewardPrize}`);
    
                    await transactionService.createTransaction({
                        hunterId: hunter._id,
                        amount: bounty.rewardPrize,
                        type: 'credit',
                        category: 'bounty',
                        description: `Winner reward for bounty: ${bounty.title}`,
                        reference: bountyId,
                        referenceModel: 'Bounty',
                        initiatedBy: {
                            id: lordId,
                            role: 'Lord'
                        },
                        metaData: {
                            rank: 1,
                            totalParticipants: sortedParticipants.length
                        }
                    });
    
                    // Add a notification about the wallet credit
                    await notificationController.createNotification({
                        hunterId: hunter._id,
                        title: 'Reward Received',
                        message: `You've received ${bounty.rewardPrize} for winning the bounty "${bounty.title}"`,
                        type: 'bounty',
                        relatedItem: bountyId,
                        itemModel: 'Bounty'
                    });
                }
    
                // Update review status to published
                participant.submission.review.reviewStatus = 'published';
    
                // Create notification for hunter
                await notificationController.createNotification({
                    hunterId: hunter._id,
                    title: 'Bounty Results Published',
                    message: `Results for "${bounty.title}" are now available. You ranked #${rank} out of ${sortedParticipants.length} hunters.`,
                    type: 'bounty',
                    relatedItem: bountyId,
                    itemModel: 'Bounty'
                });
            }
    
            // Save bounty with updated review statuses
            await bounty.save();
    
            // Award passes (assuming this also exists in your system)
            await passController.awardPassesForBounty(bountyId);
    
            // Create the result rankings data
            const resultRankings = sortedParticipants.map((participant, index) => {
                const rank = index + 1;
                const hunter = participant.hunter._id;
                const score = participant.submission.review.totalScore;
    
                // Get scores
                const scores = {
                    adherenceToBrief: participant.submission.review.adherenceToBrief,
                    conceptualThinking: participant.submission.review.conceptualThinking,
                    technicalExecution: participant.submission.review.technicalExecution,
                    originalityCreativity: participant.submission.review.originalityCreativity,
                    documentation: participant.submission.review.documentation
                };
    
                // Calculate XP
                const xpService = require('../services/xpService');
                const xpEarned = xpService.calculateReviewXP([
                    scores.adherenceToBrief,
                    scores.conceptualThinking,
                    scores.technicalExecution,
                    scores.originalityCreativity,
                    scores.documentation
                ]);
    
                // Calculate reward (only for rank 1)
                const rewardEarned = rank === 1 ? bounty.rewardPrize : 0;
    
                return {
                    hunter,
                    rank,
                    score,
                    scores,
                    xpEarned,
                    rewardEarned
                };
            });
    
            // Track non-submitters
            const nonSubmitters = nonSubmittingParticipants.map(participant => {
                return {
                    hunter: participant.hunter._id,
                    foulApplied: true,
                };
            });
    
            // Create the bounty result
            const bountyResult = await BountyResult.create({
                bounty: bountyId,
                postedBy: lordId,
                rankings: resultRankings,
                nonSubmitters
            });
    
            // Update the bounty with the result ID
            bounty.resultId = bountyResult._id;
            await bounty.save();
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty result posted successfully',
                data: {
                    bountyTitle: bounty.title,
                    totalParticipants: bounty.participants.length,
                    reviewedParticipants: reviewedParticipants.length,
                    nonSubmittingParticipants: nonSubmittingParticipants.length,
                    foulsApplied: nonSubmittingParticipants.length,
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
    },

    // Get hunter rankings for a bounty
    async getBountyRankings(req, res) {
        try {
            const { bountyId } = req.params;

            // Find the bounty
            const bounty = await Bounty.findById(bountyId)
                .populate('createdBy', 'username firstName lastName');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Response data structure
            const responseData = {
                bountyId: bounty._id,
                bountyTitle: bounty.title,
                createdBy: {
                    id: bounty.createdBy._id,
                    name: `${bounty.createdBy.firstName} ${bounty.createdBy.lastName}`,
                    username: bounty.createdBy.username
                },
                status: bounty.status,
                startTime: bounty.startTime,
                endTime: bounty.endTime,
                resultTime: bounty.resultTime,
                totalParticipants: bounty.participants.length
            };

            // If there's a result, use the stored rankings
            if (bounty.resultId) {
                const result = await BountyResult.findById(bounty.resultId)
                    .populate('rankings.hunter', 'username name email xp level')
                    .populate('nonSubmitters.hunter', 'username name email xp level');

                if (result) {
                    responseData.reviewedParticipants = result.rankings.length;
                    responseData.rankings = result.rankings.map(r => ({
                        rank: r.rank,
                        hunter: {
                            id: r.hunter._id,
                            username: r.hunter.username,
                            name: r.hunter.name
                        },
                        scores: r.scores,
                        xpEarned: r.xpEarned,
                        rewardEarned: r.rewardEarned,
                        submittedAt: r.submittedAt
                    }));

                    responseData.notSubmitted = result.nonSubmitters.map(ns => ({
                        hunter: {
                            id: ns.hunter._id,
                            username: ns.hunter.username,
                            name: ns.hunter.name
                        },
                        joined: true,
                        submitted: false,
                        foulApplied: ns.foulApplied
                    }));

                    // Set unreviewedSubmissions as empty since all are already reviewed in the result
                    responseData.unreviewedSubmissions = [];
                }
            } else {
                // If no result yet, use the live view approach with enhanced filtering
                // Populate participant data
                await bounty.populate('participants.hunter', 'username name email xp level');

                // Filter out participants with valid reviews
                const reviewedParticipants = bounty.participants.filter(
                    p => p.submission &&
                        p.submission.submittedAt &&
                        p.submission.review &&
                        typeof p.submission.review.totalScore === 'number' &&
                        p.submission.review.totalScore >= 0
                );

                // Sort participants by score (highest first)
                const rankedParticipants = reviewedParticipants.sort(
                    (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
                );

                // Format data for response
                responseData.reviewedParticipants = reviewedParticipants.length;
                responseData.rankings = rankedParticipants.map((participant, index) => ({
                    rank: index + 1,
                    hunter: {
                        id: participant.hunter._id,
                        username: participant.hunter.username,
                        name: participant.hunter.name
                    },
                    scores: {
                        adherenceToBrief: participant.submission.review.adherenceToBrief,
                        conceptualThinking: participant.submission.review.conceptualThinking,
                        technicalExecution: participant.submission.review.technicalExecution,
                        originalityCreativity: participant.submission.review.originalityCreativity,
                        documentation: participant.submission.review.documentation,
                        totalScore: participant.submission.review.totalScore
                    },
                    submittedAt: participant.submission.submittedAt,
                    reviewedAt: participant.submission.review.reviewedAt
                }));

                // Better filtering for unreviewed participants
                const unreviewedParticipants = bounty.participants
                    .filter(p => p.submission &&
                        p.submission.submittedAt &&
                        (!p.submission.review ||
                            typeof p.submission.review.totalScore !== 'number' ||
                            p.submission.review.totalScore < 0))
                    .map(p => ({
                        hunter: {
                            id: p.hunter._id,
                            username: p.hunter.username,
                            name: p.hunter.name
                        },
                        submittedAt: p.submission.submittedAt,
                        reviewed: false
                    }));
                responseData.unreviewedSubmissions = unreviewedParticipants;

                // Better filtering for non-submitting participants
                const notSubmittedParticipants = bounty.participants
                    .filter(p => !p.submission || !p.submission.submittedAt)
                    .map(p => ({
                        hunter: {
                            id: p.hunter._id,
                            username: p.hunter.username,
                            name: p.hunter.name
                        },
                        joined: true,
                        submitted: false
                    }));
                responseData.notSubmitted = notSubmittedParticipants;
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty rankings retrieved successfully',
                data: responseData
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving bounty rankings',
                error: error.message
            });
        }
    },

    // Save bounty as draft
    async saveBountyDraft(req, res) {
        try {
            const lordId = req.lord.id;
            const bountyData = req.body;

            // Set status to draft explicitly
            bountyData.status = 'draft';
            bountyData.createdBy = lordId;

            // If bountyId is provided, update existing draft
            if (bountyData._id) {
                const existingBounty = await Bounty.findOne({
                    _id: bountyData._id,
                    createdBy: lordId,
                    status: 'draft'
                });

                if (!existingBounty) {
                    return res.status(404).json({
                        status: 404,
                        success: false,
                        message: 'Draft bounty not found or cannot be edited'
                    });
                }

                // Update existing draft
                const updatedDraft = await Bounty.findByIdAndUpdate(
                    bountyData._id,
                    bountyData,
                    { new: true }
                );

                return res.status(200).json({
                    status: 200,
                    success: true,
                    message: 'Draft updated successfully',
                    data: updatedDraft
                });
            }

            // Create new draft
            const newDraft = await Bounty.create(bountyData);

            // Add to lord's bounties array
            await Lord.findByIdAndUpdate(
                lordId,
                { $push: { bounties: newDraft._id } }
            );

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Draft saved successfully',
                data: newDraft
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error saving draft',
                error: error.message
            });
        }
    },

    // Get all draft bounties
    async getDraftBounties(req, res) {
        try {
            const lordId = req.lord.id;

            const drafts = await Bounty.find({
                createdBy: lordId,
                status: 'draft'
            }).sort({ updatedAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft bounties retrieved successfully',
                data: {
                    count: drafts.length,
                    drafts
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving drafts',
                error: error.message
            });
        }
    },

    // Get a specific draft
    async getDraftBounty(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft retrieved successfully',
                data: draft
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving draft',
                error: error.message
            });
        }
    },

    // Delete a draft
    async deleteDraftBounty(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            await Bounty.findByIdAndDelete(draftId);

            // Remove from lord's bounties array
            await Lord.findByIdAndUpdate(
                lordId,
                { $pull: { bounties: draftId } }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting draft',
                error: error.message
            });
        }
    },

    // Publish a draft (change status from draft to active)
    async publishDraft(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            // Validate required fields before publishing
            const requiredFields = [
                'title', 'context', 'startTime', 'endTime', 'resultTime',
                'doubtSessionTime', 'doubtSessionDate', 'doubtSessionLink',
                'rewardPrize', 'maxHunters'
            ];

            const missingFields = requiredFields.filter(field => !draft[field]);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot publish incomplete draft',
                    missingFields
                });
            }

            // Set status based on timing
            const currentTime = new Date();
            const startTime = new Date(draft.startTime);

            const status = currentTime >= startTime ? 'active' : 'draft';

            // Update status
            const publishedBounty = await Bounty.findByIdAndUpdate(
                draftId,
                { status },
                { new: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: status === 'active' ?
                    'Bounty published and active' :
                    'Bounty scheduled for future activation',
                data: publishedBounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error publishing draft',
                error: error.message
            });
        }
    },

    // Shortlist a hunter submission
    async shortlistSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;

            // Find the bounty and verify ownership
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

            // Check if hunter has submitted work
            const participant = bounty.participants.find(
                p => p.hunter.toString() === hunterId && p.submission
            );

            if (!participant) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter submission not found for this bounty'
                });
            }

            // Check if hunter is already shortlisted
            if (bounty.shortlistedHunters.includes(hunterId)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter is already shortlisted'
                });
            }

            // Add hunter to shortlisted array
            bounty.shortlistedHunters.push(hunterId);
            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter submission shortlisted successfully',
                data: {
                    shortlistedCount: bounty.shortlistedHunters.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error shortlisting submission',
                error: error.message
            });
        }
    },

    // Remove hunter from shortlist
    async removeFromShortlist(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;

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

            // Remove hunter from shortlisted array
            bounty.shortlistedHunters = bounty.shortlistedHunters.filter(
                id => id.toString() !== hunterId
            );
            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter removed from shortlist successfully',
                data: {
                    shortlistedCount: bounty.shortlistedHunters.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error removing hunter from shortlist',
                error: error.message
            });
        }
    },

    // Get shortlisted submissions
    async getShortlistedSubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate({
                path: 'shortlistedHunters',
                select: 'username name'
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Get details of shortlisted submissions
            const shortlistedSubmissions = [];
            for (const hunter of bounty.shortlistedHunters) {
                const participant = bounty.participants.find(
                    p => p.hunter.toString() === hunter._id.toString()
                );

                if (participant && participant.submission) {
                    const reviewed = bounty.evaluatedHunters.includes(hunter._id);
                    let rank = null;

                    if (reviewed) {
                        // Find rank if reviewed
                        const reviewedParticipants = bounty.participants.filter(
                            p => p.submission && p.submission.review
                        ).sort(
                            (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
                        );

                        const rankIndex = reviewedParticipants.findIndex(
                            p => p.hunter.toString() === hunter._id.toString()
                        );

                        if (rankIndex !== -1) {
                            rank = rankIndex + 1;
                        }
                    }

                    shortlistedSubmissions.push({
                        hunterId: hunter._id,
                        username: hunter.username,
                        name: hunter.name,
                        files: participant.submission.files,
                        submittedAt: participant.submission.submittedAt,
                        reviewed,
                        rank,
                        score: reviewed ? participant.submission.review.totalScore : null
                    });
                }
            }
            console.log(shortlistedSubmissions)
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Shortlisted submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    shortlistedCount: shortlistedSubmissions.length,
                    shortlistedSubmissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving shortlisted submissions',
                error: error.message
            });
        }
    },

    // Get evaluated submissions
    async getEvaluatedSubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate({
                path: 'evaluatedHunters',
                select: 'username name'
            }).populate({
                path: 'participants.hunter',
                select: 'username name'
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Get only participants that have been properly evaluated
            const validEvaluatedParticipants = bounty.participants.filter(p =>
                p.submission &&
                p.submission.review &&
                p.submission.review.totalScore !== undefined &&
                bounty.evaluatedHunters.some(h => h._id.toString() === p.hunter._id.toString())
            );

            // Sort by score
            const sortedEvaluatedParticipants = validEvaluatedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );

            // Format evaluated submissions
            const evaluatedSubmissions = sortedEvaluatedParticipants.map((participant, index) => ({
                hunterId: participant.hunter._id,
                username: participant.hunter.username,
                name: participant.hunter.name,
                files: participant.submission.files,
                rank: index + 1,
                score: participant.submission.review.totalScore,
                shortlisted: bounty.shortlistedHunters.some(
                    id => id.toString() === participant.hunter._id.toString()
                )
            }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Evaluated submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    evaluatedCount: evaluatedSubmissions.length,
                    evaluatedSubmissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving evaluated submissions',
                error: error.message
            });
        }
    },

    // Get submissions to be evaluated
    async getSubmissionsToEvaluate(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

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

            // Find participants with submissions that haven't been evaluated
            const toEvaluateParticipants = bounty.participants.filter(
                p => p.submission &&
                    !bounty.evaluatedHunters.includes(p.hunter)
            );

            // Populate hunter details
            const submissionsToEvaluate = [];
            for (const participant of toEvaluateParticipants) {
                const hunter = await Hunter.findById(participant.hunter)
                    .select('username name');

                if (hunter) {
                    submissionsToEvaluate.push({
                        hunterId: hunter._id,
                        username: hunter.username,
                        name: hunter.name,
                        files: participant.submission.files,
                        submittedAt: participant.submission.submittedAt,
                        shortlisted: bounty.shortlistedHunters.includes(hunter._id)
                    });
                }
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submissions to evaluate retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    toEvaluateCount: submissionsToEvaluate.length,
                    submissionsToEvaluate
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving submissions to evaluate',
                error: error.message
            });
        }
    }

};

module.exports = bountyController;