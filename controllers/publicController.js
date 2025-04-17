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
      
      // Run queries in parallel for efficiency
      const [hunter, xpRanking, bountyStats] = await Promise.all([
        // Query 1: Get hunter profile data
        Hunter.findById(hunterId)
          .populate('badges.badge')
          .populate({
            path: 'titles.title',
            select: 'name description'
          })
          .select('name username xp level guild totalEarnings performance badges quizStats titles achievements.bountiesWon.count achievements.firstSubmissions.count achievements.nonProfitBounties.count status createdAt')
          .lean(),
        
        // Query 2: Get hunter's XP rank among all verified hunters
        Hunter.aggregate([
          { $match: { status: 'verified' } },
          { $sort: { xp: -1 } },
          { $group: {
              _id: null,
              hunters: { $push: { _id: '$_id', xp: '$xp' } }
            }
          },
          { $project: {
              _id: 0,
              hunterRanks: {
                $map: {
                  input: { $range: [0, { $size: '$hunters' }] },
                  as: 'index',
                  in: {
                    id: { $arrayElemAt: ['$hunters._id', '$$index'] },
                    rank: { $add: ['$$index', 1] }
                  }
                }
              }
            }
          }
        ]),
        
        // Query 3: Get bounty stats for completion rate calculation
        Bounty.aggregate([
          { $match: { 'participants.hunter': new mongoose.Types.ObjectId(hunterId) } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      
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
      
      // Find hunter's rank from the ranking results
      let xpRank = null;
      let totalVerifiedHunters = 0;
      if (xpRanking.length > 0 && xpRanking[0].hunterRanks) {
        const ranksInfo = xpRanking[0].hunterRanks;
        totalVerifiedHunters = ranksInfo.length;
        
        // Find this hunter's rank
        const hunterRankInfo = ranksInfo.find(r => r.id.toString() === hunterId);
        if (hunterRankInfo) {
          xpRank = hunterRankInfo.rank;
        }
      }
      
      // Parse the bounty stats results
      const bountyCountByStatus = {
        active: 0,
        completed: 0,
        total: 0
      };
  
      bountyStats.forEach(stat => {
        if (stat._id === 'active') {
          bountyCountByStatus.active = stat.count;
        } else if (stat._id === 'completed') {
          bountyCountByStatus.completed = stat.count;
        }
        bountyCountByStatus.total += stat.count;
      });
  
      // Calculate completion rate
      const completionRate = bountyCountByStatus.total > 0
        ? Math.round((bountyCountByStatus.completed / bountyCountByStatus.total) * 100)
        : 0;
      
      // Format active titles
      const now = new Date();
      const activeTitles = hunter.titles.filter(title => title.validUntil > now);
      
      // Calculate XP needed for next level
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
      
      // Format response data with ranking information
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
            totalBountiesCalculated: hunter.performance.totalBountiesCalculated,
            completionRate: completionRate // Add completion rate here
          },
          // Add XP ranking information
          ranking: {
            xpRank: xpRank,
            totalHunters: totalVerifiedHunters,
            percentile: xpRank ? Math.round((xpRank / totalVerifiedHunters) * 100) : null
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
            titleHolder: hunter.username
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
        stats: { // New stats section with bounty information
          activeBounties: bountyCountByStatus.active,
          totalBounties: bountyCountByStatus.total,
          completedBounties: bountyCountByStatus.completed,
          completionRate: completionRate
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
      console.error('Error in getHunterPublicProfile:', error);
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
      // Run aggregations in parallel using Promise.all
      const [bountyStats, hunterStats, guildData, titleHolders] = await Promise.all([
        // 1. Get all bounty statistics in a single aggregation
        Bounty.aggregate([
          {
            $facet: {
              'totalBounties': [{ $count: 'count' }],
              'completedBounties': [{ $match: { status: 'completed' } }, { $count: 'count' }],
              'openBounties': [{ $match: { status: 'active' } }, { $count: 'count' }],
              'upcomingBounties': [{ $match: { status: 'yts' } }, { $count: 'count' }],
              'prizePool': [
                { $match: { status: 'active' } },
                { $group: { _id: null, total: { $sum: '$rewardPrize' } } }
              ]
            }
          }
        ]),
        
        // 2. Get hunter statistics
        Hunter.aggregate([
          {
            $facet: {
              'totalHunters': [
                { $match: { status: 'verified' } },
                { $count: 'count' }
              ]
            }
          }
        ]),
        
        // 3. Get guild statistics including leading guild with members in one aggregation
        Hunter.aggregate([
          // Match verified hunters with guilds
          { $match: { status: 'verified', guild: { $exists: true, $ne: null, $ne: '' } } },
          
          // Group by guild to get primary stats
          { 
            $group: {
              _id: '$guild',
              totalMembers: { $sum: 1 },
              totalBountiesWon: { $sum: '$achievements.bountiesWon.count' },
              totalEarnings: { $sum: '$totalEarnings' },
              // Collect member details in an array
              members: { 
                $push: { 
                  id: '$_id', 
                  username: '$username', 
                  name: '$name',
                  bountiesWon: '$achievements.bountiesWon.count', 
                  earnings: '$totalEarnings' 
                } 
              }
            }
          },
          
          // Sort by bounties won
          { $sort: { totalBountiesWon: -1 } },
          
          // Project the formatted fields
          { 
            $project: {
              _id: 0,
              name: '$_id',
              totalMembers: 1,
              totalBountiesWon: 1,
              totalEarnings: 1,
              members: 1
            }
          }
        ]),
        
        // 4. Get title holders
        TitleAward.aggregate([
          // Match only active awards
          { 
            $match: { 
              validUntil: { $gt: new Date() }, 
              isRevoked: { $ne: true } 
            } 
          },
          
          // Join with titles collection
          {
            $lookup: {
              from: 'titles',
              localField: 'title',
              foreignField: '_id',
              as: 'titleData'
            }
          },
          
          // Join with hunters collection
          {
            $lookup: {
              from: 'hunters',
              localField: 'hunter',
              foreignField: '_id',
              as: 'hunterData'
            }
          },
          
          // Unwind the arrays created by lookups
          { $unwind: { path: '$titleData', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$hunterData', preserveNullAndEmptyArrays: true } },
          
          // Filter out non-verified hunters
          { $match: { 'hunterData.status': 'verified' } },
          
          // Project the fields we need
          {
            $project: {
              holderUsername: '$hunterData.username',
              holderName: '$hunterData.name',
              titleName: { $ifNull: ['$titleData.name', 'Unknown Title'] },
              titleDescription: { $ifNull: ['$titleData.description', ''] }
            }
          }
        ])
      ]);
  
      // Process bounty statistics
      const bountyStatsProcessed = {
        totalBounties: bountyStats[0].totalBounties[0]?.count || 0,
        completedBounties: bountyStats[0].completedBounties[0]?.count || 0,
        openBounties: bountyStats[0].openBounties[0]?.count || 0,
        upcomingBounties: bountyStats[0].upcomingBounties[0]?.count || 0,
        prizePool: bountyStats[0].prizePool[0]?.total || 0
      };
  
      // Process hunter statistics
      const hunterStatsProcessed = {
        totalHunters: hunterStats[0].totalHunters[0]?.count || 0
      };
  
      // Process guild statistics
      const topGuilds = guildData.slice(0, 5).map(guild => ({
        name: guild.name,
        totalMembers: guild.totalMembers,
        totalBountiesWon: guild.totalBountiesWon,
        totalEarnings: guild.totalEarnings
      }));
  
      // Process leading guild
      let leadingGuildDetail = null;
      if (guildData.length > 0) {
        const leadingGuild = guildData[0];
        
        // Get completed bounties for leading guild in a separate query
        // This is still separate because it's complex to combine with the other aggregations
        const leadingGuildCompletedBounties = await Bounty.aggregate([
          { 
            $lookup: {
              from: 'hunters',
              localField: 'participants.hunter',
              foreignField: '_id',
              as: 'hunters'
            }
          },
          { 
            $match: { 
              status: 'completed',
              'hunters.guild': leadingGuild.name
            }
          },
          { $count: 'totalCompleted' }
        ]);
        
        const completedByGuild = leadingGuildCompletedBounties.length > 0 ? 
          leadingGuildCompletedBounties[0].totalCompleted : 0;
        
        // Sort and limit members for the top guild
        const topMembers = leadingGuild.members
          .sort((a, b) => b.bountiesWon - a.bountiesWon)
          .slice(0, 10);
        
        leadingGuildDetail = {
          name: leadingGuild.name,
          totalMembers: leadingGuild.totalMembers,
          totalBountiesWon: leadingGuild.totalBountiesWon,
          totalEarnings: leadingGuild.totalEarnings,
          completedBounties: completedByGuild,
          topMembers: topMembers
        };
      }
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Platform statistics retrieved successfully',
        data: {
          hunterStats: hunterStatsProcessed,
          bountyStats: bountyStatsProcessed,
          guildStats: {
            topGuilds,
            leadingGuild: leadingGuildDetail
          },
          titleHolders
        }
      });
    } catch (error) {
      console.error('Error in getPlatformStats:', error);
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