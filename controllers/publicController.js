// controllers/publicController.js
const Hunter = require('../models/Hunter');

const publicController = {
  // Search hunters by guild, level, with sorting options
  async searchHunters(req, res) {
    try {
      const {
        guild,
        tier,
        rank,
        sortBy = 'xp',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
        name
      } = req.query;
      
      // Build query object
      const query = {};
      
      // Filter by guild if provided
      if (guild) {
        query.guild = { $regex: new RegExp(guild, 'i') }; // Case-insensitive search
      }
      
      // Filter by tier if provided (Bronze, Silver, Gold)
      if (tier) {
        query['level.tier'] = tier;
      }
      
      // Filter by rank if provided (Novice, Specialist, Master)
      if (rank) {
        query['level.rank'] = rank;
      }
      
      // Filter by name if provided
      if (name) {
        query.$or = [
          { name: { $regex: new RegExp(name, 'i') } },
          { username: { $regex: new RegExp(name, 'i') } }
        ];
      }
      
      // Only show verified hunters with completed profiles
      query.status = 'verified';
      query.username = { $exists: true, $ne: null };
      
      // Determine sort field
      let sortField;
      switch (sortBy.toLowerCase()) {
        case 'xp':
          sortField = 'xp';
          break;
        case 'performance':
          sortField = 'performance.score';
          break;
        case 'bountieswon':
          sortField = 'achievements.bountiesWon.count';
          break;
        default:
          sortField = 'xp';
      }
      
      // Determine sort order
      const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
      const sortOptions = {};
      sortOptions[sortField] = sortDirection;
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Execute query with pagination and sorting
      const hunters = await Hunter.find(query)
        .select('name username xp level guild performance.score achievements.bountiesWon.count')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
      
      // Get total count for pagination
      const total = await Hunter.countDocuments(query);
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Hunters retrieved successfully',
        data: {
          hunters: hunters.map(hunter => ({
            id: hunter._id,
            name: hunter.name,
            username: hunter.username,
            xp: hunter.xp,
            level: hunter.level,
            guild: hunter.guild,
            performanceScore: hunter.performance.score,
            bountiesWon: hunter.achievements.bountiesWon.count
          })),
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error searching hunters',
        error: error.message
      });
    }
  },

  async getHunterPublicProfile(req, res) {
    try {
      const { hunterId } = req.params;
      
      // Fetch hunter with related data, but only public information
      const hunter = await Hunter.findById(hunterId)
        .populate('badges.badge')
        .populate('titles.title')
        .select('name username xp level guild performance badges titles achievements.bountiesWon.count achievements.firstSubmissions.count achievements.nonProfitBounties.count createdAt');
      console.log(hunter)
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      
      // Only show profiles of verified hunters
    //   if (hunter.status !== 'verified') {
    //     return res.status(404).json({
    //       status: 404,
    //       success: false,
    //       message: 'Hunter profile not found'
    //     });
    //   }
      
      // Format active titles
      const now = new Date();
      const activeTitles = hunter.titles.filter(title => title.validUntil > now);
      
      // Calculate XP needed for next level (same logic as in private profile)
      let nextThreshold;
      const xp = hunter.xp;
      
      if (xp < 18000) {  // Bronze tier
        if (hunter.level.rank === 'Novice') nextThreshold = 6000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 12000;
        else nextThreshold = 18000;
      } else if (xp < 42000) {  // Silver tier
        if (hunter.level.rank === 'Novice') nextThreshold = 26000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 34000;
        else nextThreshold = 42000;
      } else {  // Gold tier
        if (hunter.level.rank === 'Novice') nextThreshold = 52000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 62000;
        else nextThreshold = 72000;
      }
      
      // Format response data - only include public information
      const publicProfileData = {
        basicInfo: {
          id: hunter._id,
          name: hunter.name,
          username: hunter.username,
          guild: hunter.guild,
          joinedAt: hunter.createdAt
        },
        progression: {
          xp: hunter.xp,
          level: {
            tier: hunter.level.tier,
            rank: hunter.level.rank
          },
          nextLevelAt: nextThreshold,
          xpNeeded: Math.max(0, nextThreshold - hunter.xp),
          performance: {
            score: hunter.performance.score,
            totalBountiesCalculated: hunter.performance.totalBountiesCalculated
          }
        },
        achievements: {
          badges: hunter.badges.map(badge => ({
            id: badge.badge?._id || badge.badge,
            name: badge.badge?.name || 'Unknown Badge',
            description: badge.badge?.description,
            earnedAt: badge.earnedAt
          })),
          activeTitles: activeTitles.map(title => ({
            id: title.title?._id || title.title,
            name: title.title?.name || 'Unknown Title',
            description: title.title?.description
          })),
          bountiesWon: hunter.achievements.bountiesWon.count,
          firstSubmissions: hunter.achievements.firstSubmissions.count,
          nonProfitBounties: hunter.achievements.nonProfitBounties.count
        }
      };
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Public profile retrieved successfully',
        data: publicProfileData
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving public profile',
        error: error.message
      });
    }
  }
};

module.exports = publicController;