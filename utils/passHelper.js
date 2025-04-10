 // Helper function to get default display names
 const   getDefaultDisplayName =(passName) => {
        const displayNames = {
            timeExtension: 'Time Extension Pass',
            cleanSlate: 'Clean Slate Pass',
            booster: 'Booster Pass',
            seasonal: 'Seasonal Pass'
        };
        
        return displayNames[passName] || passName;
    }

const calculateNextLevelThreshold = (xp, level) => {
        let nextThreshold;
        
        if (xp < 18000) {  // Bronze tier
          if (level.rank === 'Novice') nextThreshold = 6000;
          else if (level.rank === 'Specialist') nextThreshold = 12000;
          else nextThreshold = 18000;
        } else if (xp < 42000) {  // Silver tier
          if (level.rank === 'Novice') nextThreshold = 26000;
          else if (level.rank === 'Specialist') nextThreshold = 34000;
          else nextThreshold = 42000;
        } else {  // Gold tier
          if (level.rank === 'Novice') nextThreshold = 52000;
          else if (level.rank === 'Specialist') nextThreshold = 62000;
          else nextThreshold = 72000;
        }
        
        return {
          nextThreshold,
          xpNeeded: nextThreshold - xp
        };
      }

    module.exports = { getDefaultDisplayName,calculateNextLevelThreshold };