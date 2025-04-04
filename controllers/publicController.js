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
  }
};

module.exports = publicController;