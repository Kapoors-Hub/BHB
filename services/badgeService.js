// services/badgeService.js
const Hunter = require('../models/Hunter');
const Badge = require('../models/Badge');

const checkAndAwardBadges = async (hunterId) => {
    try {
        const hunter = await Hunter.findById(hunterId);
        const existingBadges = hunter.badges.map(b => b.badge.toString());
        const newBadges = [];

        // Check SuperWinner Badge
        if (hunter.achievements.bountiesWon.count >= 3 && 
            !existingBadges.includes('superWinnerBadgeId')) {
            newBadges.push({
                badge: 'superWinnerBadgeId',
                earnedAt: new Date()
            });
        }

        // Check Badge of Resilience
        if (hunter.achievements.lastPlaceFinishes.count >= 3 && 
            !existingBadges.includes('resilienceBadgeId')) {
            newBadges.push({
                badge: 'resilienceBadgeId',
                earnedAt: new Date()
            });
        }

        // Check Lightning Badge
        if (hunter.achievements.firstSubmissions.count >= 3 && 
            !existingBadges.includes('lightningBadgeId')) {
            newBadges.push({
                badge: 'lightningBadgeId',
                earnedAt: new Date()
            });
        }

        // Check Guardian of Good Badge
        if (hunter.achievements.nonProfitBounties.count >= 3 && 
            !existingBadges.includes('guardianBadgeId')) {
            newBadges.push({
                badge: 'guardianBadgeId',
                earnedAt: new Date()
            });
        }

        if (newBadges.length > 0) {
            hunter.badges.push(...newBadges);
            await hunter.save();
            return newBadges;
        }

        return null;
    } catch (error) {
        console.error('Error checking badges:', error);
        return null;
    }
};

module.exports = { checkAndAwardBadges };