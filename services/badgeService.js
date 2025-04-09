const Hunter = require('../models/Hunter');
const Badge = require("../models/Badge");
const Title = require("../models/Title")
const notificationController = require('../controllers/notificationController');
/**
 * Check and award badges to a hunter based on their achievements
 * @param {ObjectId} hunterId - The ID of the hunter
 */
async function checkAndAwardBadges(hunterId) {
    try {
      // Get the hunter with all achievement data
      const hunter = await Hunter.findById(hunterId)
        .populate('badges.badge')
        .populate('titles.title');
      
      if (!hunter) {
        console.error(`Hunter not found: ${hunterId}`);
        return;
      }
      
      // SuperWinner Badge - 3 bounties won
      if (hunter.achievements.bountiesWon.count >= 3) {
        await awardBadgeIfEligible(hunter, 'SuperWinner', 
          "Congratulations! You've earned the SuperWinner badge for winning 3 bounties!");
      }
      
      // Conqueror XV Badge - 15 bounties participated
      // We can use acceptedBounties length for this
      if (hunter.acceptedBounties.length >= 15) {
        await awardBadgeIfEligible(hunter, 'Conqueror XV', 
          "Congratulations! You've earned the Conqueror XV badge for participating in 15 bounties!");
      }
      
      // Lightning Badge - 3 first submissions
      if (hunter.achievements.firstSubmissions.count >= 3) {
        await awardBadgeIfEligible(hunter, 'Lightning', 
          "Congratulations! You've earned the Lightning badge for being the first to submit in 3 different bounties!");
      }
      
      // Guardian Of Good Badge - 3 non-profit bounties
      if (hunter.achievements.nonProfitBounties.count >= 3) {
        await awardBadgeIfEligible(hunter, 'Guardian Of Good', 
          "Congratulations! You\'ve earned the Guardian Of Good badge for completing 3 non-profit bounties!");
      }
      
      // Titan of Titles Badge - All 3 titles at least once
      // This requires knowing what the 3 titles are and checking if hunter has had each one
      // For this example, we'll assume the titles are stored in a way we can check
      await checkTitanOfTitlesBadge(hunter);
      
    } catch (error) {
      console.error('Error checking and awarding badges:', error);
    }
  }
  
  /**
   * Award a badge to a hunter if they don't already have it
   * @param {Object} hunter - The hunter object
   * @param {String} badgeName - The name of the badge to award
   * @param {String} notificationMessage - The message to send with the notification
   */
  async function awardBadgeIfEligible(hunter, badgeName, notificationMessage) {
    try {
      // Find the badge
      const badge = await Badge.findOne({ name: badgeName });
      
      if (!badge) {
        console.error(`Badge not found: ${badgeName}`);
        return;
      }
      
      // Check if hunter already has this badge
      const hasBadge = hunter.badges.some(
        b => b.badge && (b.badge._id ? b.badge._id.toString() : b.badge.toString()) === badge._id.toString()
      );
      
      if (!hasBadge) {
        // Award the badge to hunter
        await Hunter.findByIdAndUpdate(
          hunter._id,
          {
            $push: {
              badges: {
                badge: badge._id,
                earnedAt: new Date()
              }
            }
          }
        );
        
        // Create a notification for the badge award
        await notificationController.createNotification({
          hunterId: hunter._id,
          title: `Badge Earned: ${badgeName}`,
          message: notificationMessage,
          type: 'achievement'
        });
        
        console.log(`Awarded ${badgeName} badge to hunter ${hunter._id}`);
      }
    } catch (error) {
      console.error(`Error awarding ${badgeName} badge:`, error);
    }
  }
  
  /**
   * Check if hunter has earned all required titles and award Titan of Titles badge
   * @param {Object} hunter - The hunter object
   */
  async function checkTitanOfTitlesBadge(hunter) {
    try {
      // Get all titles the hunter has ever had (including current and expired)
      const allTitles = [...hunter.titles, ...hunter.expiredTitles];
      
      // Get distinct title IDs
      const uniqueTitleIds = new Set();
      allTitles.forEach(titleObj => {
        const titleId = titleObj.title._id ? titleObj.title._id.toString() : titleObj.title.toString();
        uniqueTitleIds.add(titleId);
      });
      
      // Find all available titles
      const availableTitles = await Title.find({});
      
      // If hunter has had all available titles (or at least 3 if there are more)
      if (uniqueTitleIds.size >= Math.min(3, availableTitles.length)) {
        await awardBadgeIfEligible(hunter, 'Titan of Titles', 
          'Congratulations! You\'ve earned the Titan of Titles badge for earning all 3 possible titles!');
      }
    } catch (error) {
      console.error('Error checking Titan of Titles badge:', error);
    }
  }
  
  module.exports = {
    checkAndAwardBadges
  };