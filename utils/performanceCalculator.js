const Hunter = require('../models/Hunter');
const Bounty = require('../models/Bounty');
const notificationController = require('../controllers/notificationController');

/**
 * Calculate performance score for a hunter after a bounty
 * @param {string} hunterId - Hunter ID
 * @param {string} bountyId - Bounty ID 
 * @param {number} rank - Hunter's rank in the bounty
 */
exports.calculatePerformanceScore = async (hunterId, bountyId, rank,xpEarned) => {
  try {
    // Retrieve hunter data
    const hunter = await Hunter.findById(hunterId);
    if (!hunter) {
      throw new Error('Hunter not found');
    }

    // Retrieve bounty data with all participants
    const bounty = await Bounty.findById(bountyId)
      .populate('participants.hunter', 'level xp');
    if (!bounty) {
      throw new Error('Bounty not found');
    }

    // Get total hunters in this bounty
    const totalHunters = bounty.participants.length;
    if (totalHunters === 0) {
      return null; // No hunters participated
    }

    // 1. Calculate XP Modifier (XPM)
    const maxXP = 2500; // as per your formula
    const xpm = Math.min(xpEarned / maxXP,1); // capped at 1
    console.log("------->",hunter.xp)
    // 2. Calculate Rank Modifier (RM)
    const rm = (totalHunters - rank + 1) / totalHunters;
    
    // 3. Calculate Competitor Difficulty Modifier (CDM)
    let sumLevelDifficulty = 0;
    let playerLevelDifficulty = 0;
    
    // Determine difficulty factor for each hunter
    for (const participant of bounty.participants) {
      let difficultyFactor = 0;
      
      if (participant.hunter && participant.hunter.level) {
        if (participant.hunter.level.tier === 'Gold') {
          difficultyFactor = 1;
        } else if (participant.hunter.level.tier === 'Silver') {
          difficultyFactor = 0.66;
        } else { // Bronze
          difficultyFactor = 0.33;
        }
      }
      
      sumLevelDifficulty += difficultyFactor;
      
      if (participant.hunter._id.toString() === hunterId) {
        playerLevelDifficulty = difficultyFactor;
      }
    }
    
    const cdm = sumLevelDifficulty > 0 ? 1 - (playerLevelDifficulty / sumLevelDifficulty) : 0;
    
    // Calculate performance score with weights: 34(XPM) + 33(RM) + 33(CDM)
    const performanceScore = (0.34 * xpm + 0.33 * rm + 0.33 * cdm) * 100; // Multiply by 100 to get a 0-100 scale
    console.log(performanceScore,xpm,rm,cdm)
    // Round to 2 decimal places
    const roundedScore = Math.round(performanceScore * 100) / 100;
    
    // Update hunter's performance records
    const existingScoreIndex = hunter.performance.bountyScores.findIndex(
      (item) => item.bounty.toString() === bountyId
    );
    
    if (existingScoreIndex >= 0) {
      // Update existing score
      hunter.performance.bountyScores[existingScoreIndex].score = roundedScore;
      hunter.performance.bountyScores[existingScoreIndex].calculatedAt = new Date();
    } else {
      // Add new score
      hunter.performance.bountyScores.push({
        bounty: bountyId,
        score: roundedScore,
        calculatedAt: new Date()
      });
      
      // Increment total bounties calculated
      hunter.performance.totalBountiesCalculated += 1;
    }
    
    // Calculate average performance score across all bounties
    const totalScore = hunter.performance.bountyScores.reduce((sum, item) => sum + item.score, 0);
    const averageScore = hunter.performance.totalBountiesCalculated > 0 
      ? totalScore / hunter.performance.totalBountiesCalculated 
      : roundedScore;
    console.log(averageScore)
    // Update average score
    hunter.performance.score = Math.round(averageScore * 100) / 100;
    
    // Save hunter
    await hunter.save();
    console.log(hunter.performance.score)
    // Send notification to hunter about new performance score
    await notificationController.createNotification({
      hunterId: hunterId,
      title: 'Performance Score Updated',
      message: `Your performance score for the bounty "${bounty.title}" is ${roundedScore}. Your overall score is now ${hunter.performance.score}.`,
      type: 'system',
      relatedItem: bountyId,
      itemModel: 'Bounty'
    });
    
    return {
      bountyScore: roundedScore,
      overallScore: hunter.performance.score,
      factors: {
        xpm,
        rm,
        cdm
      }
    };
  } catch (error) {
    console.error('Error calculating performance score:', error);
    throw error;
  }
};