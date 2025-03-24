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
    },

    // Award badge to hunter
async awardBadgeToHunter(req, res) {
    try {
      const { hunterId } = req.params;
      const { badgeId, reason } = req.body;
      const adminId = req.admin.id;
  
      // Validate inputs
      if (!badgeId) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Badge ID is required'
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
  
      // Check if badge exists
      const badge = await Badge.findById(badgeId);
      if (!badge) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Badge not found'
        });
      }
  
      // Check if hunter already has this badge
      const hasBadge = hunter.badges.some(
        item => item.badge.toString() === badgeId
      );
  
      if (hasBadge) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Hunter already has this badge'
        });
      }
  
      // Award badge to hunter
      hunter.badges.push({
        badge: badgeId,
        earnedAt: new Date()
      });
  
      await hunter.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'New Badge Awarded',
        message: `You've been awarded the "${badge.name}" badge${reason ? ` for: ${reason}` : ''}!`,
        type: 'achievement'
      });
  
      // Log the action
      console.log(`Admin ${adminId} awarded badge ${badgeId} to hunter ${hunterId}`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Badge awarded successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          badge: {
            id: badge._id,
            name: badge.name,
            description: badge.description
          },
          awardedAt: hunter.badges[hunter.badges.length - 1].earnedAt
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error awarding badge',
        error: error.message
      });
    }
  },
  
  // Revoke badge from hunter
  async revokeBadgeFromHunter(req, res) {
    try {
      const { hunterId, badgeId } = req.params;
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
  
      // Check if badge exists
      const badge = await Badge.findById(badgeId);
      if (!badge) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Badge not found'
        });
      }
  
      // Check if hunter has this badge
      const badgeIndex = hunter.badges.findIndex(
        item => item.badge.toString() === badgeId
      );
  
      if (badgeIndex === -1) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Hunter does not have this badge'
        });
      }
  
      // Remove badge from hunter
      hunter.badges.splice(badgeIndex, 1);
      await hunter.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Badge Revoked',
        message: `Your "${badge.name}" badge has been revoked${reason ? ` for: ${reason}` : ''}.`,
        type: 'system'
      });
  
      // Log the action
      console.log(`Admin ${adminId} revoked badge ${badgeId} from hunter ${hunterId}`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Badge revoked successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          badge: {
            id: badge._id,
            name: badge.name
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error revoking badge',
        error: error.message
      });
    }
  }
};

module.exports = badgeController;