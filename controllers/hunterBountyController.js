// controllers/hunterBountyController.js
const Bounty = require('../models/Bounty');
const BountyResult = require('../models/BountyResult');
const Hunter = require('../models/Hunter');
const { calculateReviewXP } = require('../services/xpService');
const notificationController = require('./notificationController');
const path = require('path');

const hunterBountyController = {
    // Get all available bounties
    async getAvailableBounties(req, res) {
        try {
          // Get pagination parameters from request query with defaults
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 20;
          const skip = (page - 1) * limit;
          
          // Get filter parameters if needed
          // const { status, category, minReward } = req.query;
          
          // Build the query object (currently showing all bounties)
          const query = {};
          
          // Use lean() for better performance when you don't need Mongoose documents
          // Use select() to only fetch the fields you actually need
          // Use projection in populate to only get required fields
          const [bounties, totalCount] = await Promise.all([
            Bounty.find(query)
              .select('title description rewardPrize deadline status category tags createdAt createdBy')
              .populate('createdBy', 'username name')
              .sort({ createdAt: -1 })  // Sort by newest first
              .skip(skip)
              .limit(limit)
              .lean(),  // Convert to plain JavaScript objects
              
            Bounty.countDocuments(query)  // Get total count for pagination
          ]);
      
          // Calculate pagination metadata
          const totalPages = Math.ceil(totalCount / limit);
          const hasNextPage = page < totalPages;
          const hasPrevPage = page > 1;
          
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Available bounties fetched successfully',
            data: {
              bounties,
              pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage,
                hasPrevPage
              }
            }
          });
        } catch (error) {
          console.error('Error in getAvailableBounties:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error fetching bounties',
            error: error.message
          });
        }
      },
    // Get single bounty details
    async getBountyDetails(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId)
                .populate('createdBy', 'username')
                .populate('participants.hunter', 'username');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty details fetched successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounty details',
                error: error.message
            });
        }
    },

    // Check if hunter has accepted a bounty

async checkAcceptedBountyStatus(req, res) {
    try {
        const { bountyId } = req.params;
        const hunterId = req.hunter.id;
        
        // Find the hunter
        const hunter = await Hunter.findById(hunterId);
        
        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found'
            });
        }
        
        // Check if the bounty ID is in the hunter's acceptedBounties array
        const isAccepted = hunter.acceptedBounties.includes(bountyId);
        
        // Check if the bounty ID is in the hunter's quitBounties array
        const hasQuit = hunter.quitBounties.includes(bountyId);
        
        // Get additional details if the bounty is accepted
        let bountyDetails = null;
        let participantStatus = null;
        
        if (isAccepted) {
            const bounty = await Bounty.findOne({
                _id: bountyId,
                'participants.hunter': hunterId
            });
            
            if (bounty) {
                const participant = bounty.participants.find(
                    p => p.hunter.toString() === hunterId
                );
                
                if (participant) {
                    participantStatus = participant.status;
                    
                    bountyDetails = {
                        title: bounty.title,
                        status: bounty.status,
                        startTime: bounty.startTime,
                        endTime: bounty.endTime,
                        hasSubmitted: participant.submission && participant.submission.submittedAt ? true : false,
                        participantStatus: participantStatus
                    };
                }
            }
        }
        
        return res.status(200).json({
            status: 200,
            success: true,
            data: {
                isAccepted,
                hasQuit,
                bountyId,
                participantStatus,
                bountyDetails
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error checking bounty status',
            error: error.message
        });
    }
},

    // Accept a bounty
    async acceptBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);
            const hunterId = req.hunter.id;

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Check if bounty is still accepting hunters
            if (bounty.currentHunters >= bounty.maxHunters) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Bounty has reached maximum participants'
                });
            }

            // Check if hunter already participating
            const isParticipating = bounty.participants.some(
                p => p.hunter.toString() === hunterId
            );

            if (isParticipating) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'You are already participating in this bounty'
                });
            }

            // Add hunter to participants array and increment currentHunters
            await Bounty.findByIdAndUpdate(
                bounty._id,
                {
                    $push: {
                        participants: {
                            hunter: hunterId,
                            joinedAt: new Date(),
                            status: 'active'
                        }
                    },
                    $inc: { currentHunters: 1 }
                },
                { new: true }
            );

            // Add bounty to hunter's accepted bounties
            await Hunter.findByIdAndUpdate(
                hunterId,
                { $push: { acceptedBounties: bounty._id } }
            );

            const updatedBounty = await Bounty.findById(bounty._id)
                .populate('participants.hunter', 'username');

            await notificationController.createNotification({
                    hunterId: hunterId,
                    title: 'Bounty Accepted',
                    message: `You've successfully accepted the bounty: ${bounty.title}`,
                    type: 'bounty',
                    relatedItem: bounty._id,
                    itemModel: 'Bounty'
                });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty accepted successfully',
                data: updatedBounty
            });

        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error accepting bounty',
                error: error.message
            });
        }
    },

    // Get my accepted bounties
    async getMyBounties(req, res) {
        try {
            const hunterId = req.hunter.id;

            const participatingBounties = await Bounty.find({
                'participants.hunter': hunterId
            }).populate('createdBy', 'username');

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Your bounties fetched successfully',
                data: participatingBounties
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching your bounties',
                error: error.message
            });
        }
    },

    // Submit Bounty
    async submitBountyWork(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            const { description } = req.body;
            const files = req.files; // Multer adds files to req

            // Find the bounty
            const bounty = await Bounty.findById(bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Check if hunter is a participant
            const isParticipant = bounty.participants.some(
                p => p.hunter.toString() === hunterId && p.status === 'active'
            );

            if (!isParticipant) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'You are not a participant of this bounty'
                });
            }

            // Check if bounty is still active
            // if (bounty.status !== 'active') {
            //     return res.status(400).json({
            //         status: 400,
            //         success: false,
            //         message: 'Bounty is not active for submissions'
            //     });
            // }

            // Check if submission is within time limit
            const currentTime = new Date();
            if (currentTime > bounty.endTime) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Submission deadline has passed'
                });
            }

            // Process uploaded files
            const fileDetails = files.map(file => ({
                fileName: file.originalname,
                filePath: file.path,
                uploadedAt: new Date()
            }));

            // Update participant's submission
            await Bounty.findOneAndUpdate(
                {
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.submission': {
                            description,
                            files: fileDetails,
                            submittedAt: new Date()
                        },
                        'participants.$.status': 'completed'
                    }
                }
            );

            await notificationController.createNotification({
                hunterId: hunterId,
                title: 'Submission Successful',
                message: `Your work for bounty "${bounty.title}" has been submitted successfully.`,
                type: 'bounty',
                relatedItem: bounty._id,
                itemModel: 'Bounty'
            });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Work submitted successfully',
                data: {
                    submissionTime: new Date(),
                    bountyTitle: bounty.title,
                    filesUploaded: fileDetails.map(f => f.fileName)
                }
            });

        } catch (error) {
            console.error('Submission error:', error);
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error submitting work',
                error: error.message
            });
        }
    },

    // Get Score
    async getMyScore(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            
            const bounty = await Bounty.findById(bountyId).populate('createdBy', 'username');
            
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
            
            // Find hunter's participation
            const participation = bounty.participants.find(
                p => p.hunter.toString() === hunterId
            );
            
            if (!participation) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'You are not a participant in this bounty'
                });
            }
            
            if (!participation.submission || !participation.submission.submittedAt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'You have not submitted any work for this bounty'
                });
            }
            
            if (!participation.submission.review || !participation.submission.review.reviewedAt) {
                return res.status(200).json({
                    status: 200,
                    success: true,
                    message: 'Your submission has not been reviewed yet',
                    data: {
                        bountyTitle: bounty.title,
                        reviewed: false
                    }
                });
            }

            const adherenceToBrief= participation.submission.review.adherenceToBrief
            const    conceptualThinking= participation.submission.review.conceptualThinking
            const   technicalExecution= participation.submission.review.technicalExecution
            const    originalityCreativity= participation.submission.review.originalityCreativity
            const    documentation= participation.submission.review.documentation
            
            // Get review scores
            const scores = [
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation
            ];
            
            // Calculate XP using XP service
            const xp = calculateReviewXP(scores);
            
            // Return score details with XP information
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Score retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    reviewed: true,
                    reviewedAt: participation.submission.review.reviewedAt,
                    scores: {
                        adherenceToBrief: participation.submission.review.adherenceToBrief,
                        conceptualThinking: participation.submission.review.conceptualThinking,
                        technicalExecution: participation.submission.review.technicalExecution,
                        originalityCreativity: participation.submission.review.originalityCreativity,
                        documentation: participation.submission.review.documentation
                    },
                    totalScore: participation.submission.review.totalScore,
                    feedback: participation.submission.review.feedback,
                    xpEarned: xp // Add the XP information to the response
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving score',
                error: error.message
            });
        }
    },

    // Get hunter rankings for a bounty
    async getBountyRankings(req, res) {
        try {
            const { bountyId } = req.params;

            // Find the bounty and populate hunter information
            const bounty = await Bounty.findById(bountyId)
                .populate('participants.hunter', 'username name email xp level')
                .populate('createdBy', 'username firstName lastName');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Filter out participants with reviews
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission && p.submission.review
            );

            // Sort participants by score (highest first)
            const rankedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );

            // Format data for response
            const rankings = rankedParticipants.map((participant, index) => ({
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

            // Get unreviewed participants
            const unreviewedParticipants = bounty.participants
                .filter(p => p.submission && !p.submission.review)
                .map(p => ({
                    hunter: {
                        id: p.hunter._id,
                        username: p.hunter.username,
                        name: p.hunter.name
                    },
                    submittedAt: p.submission.submittedAt,
                    reviewed: false
                }));

            // Get participants who haven't submitted yet
            const notSubmittedParticipants = bounty.participants
                .filter(p => !p.submission)
                .map(p => ({
                    hunter: {
                        id: p.hunter._id,
                        username: p.hunter.username,
                        name: p.hunter.name
                    },
                    joined: true,
                    submitted: false
                }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty rankings retrieved successfully',
                data: {
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
                    totalParticipants: bounty.participants.length,
                    reviewedParticipants: reviewedParticipants.length,
                    rankings,
                    unreviewedSubmissions: unreviewedParticipants,
                    notSubmitted: notSubmittedParticipants
                }
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

// Quit/withdraw from a bounty
async quitBounty(req, res) {
    try {
        const { bountyId } = req.params;
        const hunterId = req.hunter.id;
        
        // Find the bounty
        const bounty = await Bounty.findById(bountyId);
        
        if (!bounty) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Bounty not found'
            });
        }
        
        // Check if hunter is participating in this bounty
        const participantIndex = bounty.participants.findIndex(
            p => p.hunter.toString() === hunterId
        );
        
        if (participantIndex === -1) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'You are not participating in this bounty'
            });
        }
        
        // Check if bounty is active
        // if (bounty.status !== 'active') {
        //     return res.status(400).json({
        //         status: 400,
        //         success: false,
        //         message: 'Can only withdraw from active bounties'
        //     });
        // }
        
        // Check if hunter has already submitted work
        if (bounty.participants[participantIndex].submission && 
            bounty.participants[participantIndex].submission.submittedAt) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Cannot withdraw after submitting work'
            });
        }
        
        // Update participant status to withdrawn
        bounty.participants[participantIndex].status = 'withdrawn';
        
        // Decrement currentHunters count
        bounty.currentHunters -= 1;
        
        await bounty.save();
        
        // Update hunter: Remove from acceptedBounties and add to quitBounties
        await Hunter.findByIdAndUpdate(
            hunterId,
            { 
                $pull: { acceptedBounties: bountyId },
                $addToSet: { quitBounties: bountyId } // Use addToSet to avoid duplicates
            }
        );
        
        // Create notification for hunter
        await notificationController.createNotification({
            hunterId: hunterId,
            title: 'Bounty Withdrawal',
            message: `You have successfully withdrawn from the bounty: ${bounty.title}`,
            type: 'bounty',
            relatedItem: bountyId,
            itemModel: 'Bounty'
        });
        
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Successfully withdrawn from bounty',
            data: {
                bountyTitle: bounty.title,
                withdrawalDate: new Date()
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error withdrawing from bounty',
            error: error.message
        });
    }
},

// Add to hunterBountyController.js
async getMyRankings(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Find all bounty results where this hunter is ranked
      const results = await BountyResult.find({
        'rankings.hunter': hunterId
      })
      .populate('bounty', 'title status startTime endTime resultTime rewardPrize')
      .sort({ postedAt: -1 });
      
      // Format hunter's results
      const myRankings = results.map(result => {
        const myRanking = result.rankings.find(r => 
          r.hunter.toString() === hunterId
        );
        
        return {
          bountyId: result.bounty._id,
          bountyTitle: result.bounty.title,
          bountyStatus: result.bounty.status,
          resultPostedAt: result.postedAt,
          rank: myRanking.rank,
          totalParticipants: result.rankings.length,
          score: myRanking.score,
          xpEarned: myRanking.xpEarned,
          rewardEarned: myRanking.rewardEarned
        };
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Your rankings retrieved successfully',
        data: {
          totalBounties: myRankings.length,
          rankings: myRankings
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving your rankings',
        error: error.message
      });
    }
  },

  async getMyQuitBounties(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Find the hunter and select only the quitBounties field
      const hunter = await Hunter.findById(hunterId).select('quitBounties');
      
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
        message: 'Quit bounty IDs retrieved successfully',
        data: {
          count: hunter.quitBounties.length,
          quitBountyIds: hunter.quitBounties
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving quit bounty IDs',
        error: error.message
      });
    }
  }

};

module.exports = hunterBountyController;