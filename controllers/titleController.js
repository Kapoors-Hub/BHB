// controllers/titleController.js
const Title = require('../models/Title');
const TitleAward = require('../models/TitleAward');
const Hunter = require('../models/Hunter');

const titleController = {
    // Create a new title
    async createTitle(req, res) {
        try {
            const { name, description, criteria, icon } = req.body;
            const adminId = req.admin.id;

            const title = await Title.create({
                name,
                description,
                criteria,
                icon,
                createdBy: adminId
            });

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Title created successfully',
                data: title
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating title',
                error: error.message
            });
        }
    },

    // Get all titles
    async getAllTitles(req, res) {
        try {
            const titles = await Title.find().sort({ createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Titles retrieved successfully',
                data: titles
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving titles',
                error: error.message
            });
        }
    },

    // Award a title to a hunter
    async awardTitle(req, res) {
        try {
            const { titleId, hunterId, reason } = req.body;
            const adminId = req.admin.id;

            // Validate inputs
            if (!titleId || !hunterId) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Title ID and Hunter ID are required'
                });
            }

            // Check if title exists
            const title = await Title.findById(titleId);
            if (!title || !title.active) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Title not found or inactive'
                });
            }
            console.log(hunterId)
            // Check if hunter exists
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }

            // Calculate validity period (25th of current month to 25th of next month)
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth(); // 0-11
            
            // Current month's 25th
            let validFrom = new Date(currentYear, currentMonth, 25);
            // If today is after the 25th, use next month
            if (now.getDate() > 25) {
                validFrom = new Date(currentYear, currentMonth + 1, 25);
            }
            
            // Valid until the 25th of the next month
            const validUntil = new Date(validFrom);
            validUntil.setMonth(validUntil.getMonth() + 1);

            // Check if this title is already awarded for this month
            const existingAward = await TitleAward.findOne({
                title: titleId,
                month: validFrom.getMonth() + 1, // 1-12
                year: validFrom.getFullYear()
            });

            if (existingAward) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'This title has already been awarded for this month',
                    data: {
                        currentHolder: existingAward.hunter
                    }
                });
            }

            // Create title award record
            const titleAward = await TitleAward.create({
                title: titleId,
                hunter: hunterId,
                month: validFrom.getMonth() + 1, // 1-12
                year: validFrom.getFullYear(),
                validFrom,
                validUntil,
                awardedBy: adminId,
                reason: reason || 'Exceptional performance'
            });

            // Add title to hunter's titles
            await Hunter.findByIdAndUpdate(hunterId, {
                $push: {
                    titles: {
                        title: titleId,
                        awardedAt: new Date(),
                        validUntil,
                        awardedBy: adminId
                    }
                }
            });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Title awarded successfully',
                data: titleAward
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error awarding title',
                error: error.message
            });
        }
    },

    // Get hunters with active titles
    async getCurrentTitleHolders(req, res) {
        try {
            const now = new Date();
            
            // Find all active title awards
            const currentAwards = await TitleAward.find({
                validFrom: { $lte: now },
                validUntil: { $gt: now }
            })
            .populate('title', 'name description criteria icon')
            .populate('hunter', 'username name');

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Current title holders retrieved successfully',
                data: currentAwards
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving current title holders',
                error: error.message
            });
        }
    },

    // Generate title recommendations based on performance
    async generateTitleRecommendations(req, res) {
        try {
            // Get date range for last month
            const now = new Date();
            const lastMonth = new Date(now);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            
            // Find top performers
            const mostWins = await Hunter.aggregate([
                {
                    $match: {
                        'achievements.bountiesWon.bountyIds': { $exists: true, $ne: [] }
                    }
                },
                {
                    $project: {
                        name: 1,
                        username: 1,
                        // Filter bounties won in the last month
                        recentWins: {
                            $filter: {
                                input: '$achievements.bountiesWon.bountyIds',
                                as: 'bountyId',
                                cond: { $gte: ['$$bountyId.createdAt', lastMonth] }
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        winCount: { $size: '$recentWins' }
                    }
                },
                {
                    $sort: { winCount: -1 }
                },
                {
                    $limit: 5
                }
            ]);

            // Find most active hunters
            const mostActive = await Hunter.aggregate([
                {
                    $match: {
                        'acceptedBounties': { $exists: true, $ne: [] }
                    }
                },
                {
                    $project: {
                        name: 1,
                        username: 1,
                        bountyCount: { $size: '$acceptedBounties' }
                    }
                },
                {
                    $sort: { bountyCount: -1 }
                },
                {
                    $limit: 5
                }
            ]);

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Title recommendations generated',
                data: {
                    recommendations: {
                        'The Unstoppable': mostWins.length > 0 ? mostWins[0] : null,
                        'Star Trainer': mostActive.length > 0 ? mostActive[0] : null,
                        // Crazy Hunter needs manual selection
                        'Crazy Hunter': 'Manual selection required'
                    },
                    topWinners: mostWins,
                    mostActive: mostActive
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error generating title recommendations',
                error: error.message
            });
        }
    },

    // Revoke title from hunter
async revokeTitleFromHunter(req, res) {
    try {
      const { hunterId, titleId } = req.params;
      const { reason } = req.body;
      const adminId = req.admin.id;
  
      // Check if hunter exists
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Check if title exists
      const title = await Title.findById(titleId);
      if (!title) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Title not found'
        });
      }
  
      // Check if hunter has this title
      const titleIndex = hunter.titles.findIndex(
        item => item.title.toString() === titleId
      );
  
      if (titleIndex === -1) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Hunter does not have this title'
        });
      }
  
      // Remove title from hunter
      hunter.titles.splice(titleIndex, 1);
      await hunter.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Title Revoked',
        message: `Your "${title.name}" title has been revoked${reason ? ` for: ${reason}` : ''}.`,
        type: 'system'
      });
  
      // Log the action
      console.log(`Admin ${adminId} revoked title ${titleId} from hunter ${hunterId}`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Title revoked successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          title: {
            id: title._id,
            name: title.name
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error revoking title',
        error: error.message
      });
    }
  },
  
  // Extend title validity
  async extendTitleValidity(req, res) {
    try {
      const { hunterId, titleId } = req.params;
      const { extensionDays } = req.body;
      const adminId = req.admin.id;
  
      if (!extensionDays || isNaN(extensionDays) || extensionDays <= 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid extension days are required'
        });
      }
  
      // Check if hunter exists
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Check if title exists
      const title = await Title.findById(titleId);
      if (!title) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Title not found'
        });
      }
  
      // Find the title in hunter's titles
      const titleIndex = hunter.titles.findIndex(
        item => item.title.toString() === titleId
      );
  
      if (titleIndex === -1) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Hunter does not have this title'
        });
      }
  
      // Get current validity date
      const currentValidUntil = new Date(hunter.titles[titleIndex].validUntil);
      
      // Calculate new validity date
      const newValidUntil = new Date(currentValidUntil);
      newValidUntil.setDate(newValidUntil.getDate() + extensionDays);
      
      // Update title validity
      hunter.titles[titleIndex].validUntil = newValidUntil;
      await hunter.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Title Extended',
        message: `Your "${title.name}" title has been extended by ${extensionDays} days. New expiration: ${newValidUntil.toDateString()}.`,
        type: 'system'
      });
  
      // Log the action
      console.log(`Admin ${adminId} extended title ${titleId} for hunter ${hunterId} by ${extensionDays} days`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Title validity extended successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          title: {
            id: title._id,
            name: title.name
          },
          previousValidUntil: currentValidUntil,
          newValidUntil: newValidUntil,
          extensionDays
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error extending title validity',
        error: error.message
      });
    }
  }
};

module.exports = titleController;