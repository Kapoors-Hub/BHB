// services/xpService.js
const Hunter = require('../models/Hunter');
// Calculate XP from review scores
const calculateReviewXP = (scores) => {
    let xpChange = 0;
    
    // Apply XP calculation formula for each parameter:
    // Scores above 2.5: score * 100 XP
    // Scores below 2.5: -1 * (3-score) * 100 XP
    scores.forEach(score => {
      if (score >= 3) {
        xpChange += score * 100;
      } else if (score <= 2) {
        xpChange -= (3 - score) * 100;
      }
    });
    
    return xpChange;
  };
  
  // Update hunter's XP
  const updateHunterXP = async (hunterId, xpAmount) => {
    try {
      const hunter = await Hunter.findById(hunterId);
      if (hunter) {
        hunter.xp += xpAmount;
        await hunter.save();
        return hunter.xp;
      }
      return null;
    } catch (error) {
      console.error('Error updating hunter XP:', error);
      throw error;
    }
  };
  
  // Add other XP calculation methods here for different scenarios
  // For example: bounty completion, first submissions, etc.
  
  module.exports = {
    calculateReviewXP,
    updateHunterXP
  };