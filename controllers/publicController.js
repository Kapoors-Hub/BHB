// controllers/publicController.js
const Bounty = require('../models/Bounty');
const Hunter = require('../models/Hunter');
const TitleAward = require('../models/TitleAward');

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
        .populate({
          path: 'titles.title',
          select: 'name description' // Ensure we select title name and description
        })
        .select('name username xp level guild totalEarnings performance badges quizStats titles achievements.bountiesWon.count achievements.firstSubmissions.count achievements.nonProfitBounties.count status createdAt');
      
      console.log(hunter);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
      
      // Only show profiles of verified hunters
      if (hunter.status !== 'verified') {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter profile not found'
        });
      }
      
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
        financial: {
          totalEarnings: hunter.totalEarnings || 0
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
            description: title.title?.description,
            titleHolder: hunter.username // Include the title holder's username
          })),
          currentTitles: activeTitles.length > 0 ? {
            titleHolder: hunter.username,
            titles: activeTitles.map(title => ({
              name: title.title?.name || 'Unknown Title',
              description: title.title?.description
            }))
          } : null,
          bountiesWon: hunter.achievements.bountiesWon.count,
          firstSubmissions: hunter.achievements.firstSubmissions.count,
          nonProfitBounties: hunter.achievements.nonProfitBounties.count
        },
        quizStats: {
          totalQuizzes: hunter.quizStats?.totalQuizzes || 0,
          totalXpEarned: hunter.quizStats?.totalXpEarned || 0,
          correctAnswers: hunter.quizStats?.correctAnswers || 0,
          totalQuestions: hunter.quizStats?.totalQuestions || 0,
          accuracy: hunter.quizStats?.totalQuestions ? 
            Math.round((hunter.quizStats.correctAnswers / hunter.quizStats.totalQuestions) * 100) : 0
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
  },
 
  async getPlatformStats(req, res) {
    try {
      // Get count of verified hunters
      const totalHunters = await Hunter.countDocuments({ status: 'verified' });
      
      // Get sum of reward prizes for all active bounties
      const activeBounties = await Bounty.find({ status: 'active' });
      const prizePool = activeBounties.reduce((total, bounty) => total + (bounty.rewardPrize || 0), 0);
      
      // Get count of completed bounties
      const completedBounties = await Bounty.countDocuments({ status: 'completed' });
      
      // Calculate additional statistics
      const totalBounties = await Bounty.countDocuments();
      const openBounties = await Bounty.countDocuments({ status: 'active' });
      const upcomingBounties = await Bounty.countDocuments({ status: 'yts' });
      
      // Get guild statistics
      const guildStats = await Hunter.aggregate([
        // Only consider verified hunters
        { $match: { status: 'verified', guild: { $exists: true, $ne: null, $ne: '' } } },
        
        // Group by guild
        { $group: {
            _id: '$guild',
            totalMembers: { $sum: 1 },
            totalBountiesWon: { $sum: '$achievements.bountiesWon.count' },
            totalEarnings: { $sum: '$totalEarnings' }
        }},
        
        // Sort by total bounties won (descending)
        { $sort: { totalBountiesWon: -1 } },
        
        // Limit to top 5 guilds
        { $limit: 5 },
        
        // Project the fields we want
        { $project: {
            _id: 0,
            name: '$_id',
            totalMembers: 1,
            totalBountiesWon: 1,
            totalEarnings: 1
        }}
      ]);
      
      // Get additional data for the leading guild (if any)
      let leadingGuildDetail = null;
      if (guildStats.length > 0) {
        const leadingGuild = guildStats[0];
        
        // Get members of the leading guild with their individual contribution
        const leadingGuildMembers = await Hunter.find(
          { guild: leadingGuild.name, status: 'verified' }
        )
        .select('username name achievements.bountiesWon.count totalEarnings')
        .sort({ 'achievements.bountiesWon.count': -1 })
        .limit(10);
        
        // Get completed bounties for this guild
        const leadingGuildCompletedBounties = await Bounty.aggregate([
          // Join with Hunter collection
          { $lookup: {
              from: 'hunters',
              localField: 'participants.hunter',
              foreignField: '_id',
              as: 'hunters'
          }},
          
          // Filter for completed bounties with winners from the leading guild
          { $match: { 
              status: 'completed',
              'hunters.guild': leadingGuild.name
          }},
          
          // Count the bounties
          { $count: 'totalCompleted' }
        ]);
        
        const completedByGuild = leadingGuildCompletedBounties.length > 0 ? 
          leadingGuildCompletedBounties[0].totalCompleted : 0;
        
        leadingGuildDetail = {
          ...leadingGuild,
          completedBounties: completedByGuild,
          topMembers: leadingGuildMembers.map(member => ({
            id: member._id,
            username: member.username,
            name: member.name,
            bountiesWon: member.achievements.bountiesWon.count,
            earnings: member.totalEarnings
          }))
        };
      }
      
      // NEW CODE: Get current title holders using TitleAward schema
      const now = new Date();
      
      // Find active title awards
      const activeTitleAwards = await TitleAward.find({
        validUntil: { $gt: now },
        isRevoked: { $ne: true }
      })
      .populate({
        path: 'title',
        select: 'name description'
      })
      .populate({
        path: 'hunter',
        select: 'username name status',
        match: { status: 'verified' }  // Only include verified hunters
      });
      
      // Filter out awards where hunter is not verified and format the data
      const titleHolders = activeTitleAwards
        .filter(award => award.hunter) // Filter out null hunters (unverified)
        .map(award => ({
          holderUsername: award.hunter.username,
          holderName: award.hunter.name,
          holderId: award.hunter._id,
          titleName: award.title?.name || 'Unknown Title',
          titleDescription: award.title?.description || '',
          validUntil: award.validUntil,
          awardedAt: award.awardedAt,
          month: award.month,
          year: award.year
        }));
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Platform statistics retrieved successfully',
        data: {
          hunterStats: {
            totalHunters
          },
          bountyStats: {
            totalBounties,
            completedBounties,
            openBounties,
            upcomingBounties,
            prizePool
          },
          guildStats: {
            topGuilds: guildStats,
            leadingGuild: leadingGuildDetail
          },
          titleHolders: titleHolders
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving platform statistics',
        error: error.message
      });
    }
  }
};

module.exports = publicController;