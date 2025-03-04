// config/cronJobs.js
const cron = require('node-cron');
const Bounty = require('../models/Bounty');
const Hunter = require('../models/Hunter');

const initCronJobs = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const currentTime = new Date();
            console.log('Running bounty status update check at:', currentTime);

            // Update draft to active
            const draftResults = await Bounty.updateMany(
                {
                    status: 'draft',
                    startTime: { $lte: currentTime }
                },
                { $set: { status: 'active' } }
            );

            // Update active to completed
            const activeResults = await Bounty.updateMany(
                {
                    status: 'active',
                    endTime: { $lte: currentTime }
                },
                { $set: { status: 'completed' } }
            );

            // Log status changes
            if (draftResults.modifiedCount > 0 || activeResults.modifiedCount > 0) {
                console.log('Status updates:', {
                    draftToActive: draftResults.modifiedCount,
                    activeToCompleted: activeResults.modifiedCount
                });
            }
        } catch (error) {
            console.error('Error updating bounty statuses:', error);
        }
    });

    // Add to config/cronJobs.js
    // Remove expired titles from hunter profiles - run daily at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            const now = new Date();

            // Find hunters with expired titles
            const hunters = await Hunter.find({
                'titles.validUntil': { $lt: now }
            });

            // For each hunter, move expired titles to history
            for (const hunter of hunters) {
                const activeTitles = hunter.titles.filter(title =>
                    title.validUntil > now
                );

                hunter.titles = activeTitles;
                await hunter.save();
            }

            console.log('Expired titles cleaned up');
        } catch (error) {
            console.error('Error cleaning up expired titles:', error);
        }
    });
};

module.exports = initCronJobs;

// config/cronJobs.js
// const cron = require('node-cron');
// const Bounty = require('../models/Bounty');

// const initCronJobs = () => {
//     // Every minute
//     cron.schedule('* * * * *', async () => {
//         // Your status update code
//     });

//     // Every 5 minutes
//     cron.schedule('*/5 * * * *', async () => {
//         // Code
//     });

//     // Every hour
//     cron.schedule('0 * * * *', async () => {
//         // Code
//     });

//     // Every day at midnight
//     cron.schedule('0 0 * * *', async () => {
//         // Code
//     });

//     // Every Sunday at 00:00
//     cron.schedule('0 0 * * 0', async () => {
//         // Code
//     });

//     // Multiple times example
//     cron.schedule('0 9,17 * * *', async () => {
//         // Runs at 9 AM and 5 PM
//     });
// };