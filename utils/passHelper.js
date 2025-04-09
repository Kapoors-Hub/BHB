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

    module.exports = { getDefaultDisplayName };