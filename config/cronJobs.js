// config/cronJobs.js
const cron = require('node-cron');
const Bounty = require('../models/Bounty');
const Hunter = require('../models/Hunter');

const initCronJobs = () => {
    // Add this to your config/cronJobs.js file
    cron.schedule('00 8 * * *', async () => {
        try {

            // Use IST (UTC+5:30)
            const currentDate = new Date();
            const offset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds for IST

            // Adjust to IST
            const istDate = new Date(currentDate.getTime() + offset);
            const todayStart = new Date(Date.UTC(
                istDate.getUTCFullYear(),
                istDate.getUTCMonth(),
                istDate.getUTCDate()
            ));
            const todayEnd = new Date(Date.UTC(
                istDate.getUTCFullYear(),
                istDate.getUTCMonth(),
                istDate.getUTCDate(),
                23, 59, 59
            ));

            console.log('Running scheduled bounty activation at 8 AM for date:', todayStart.toISOString().split('T')[0]);

            
            // Find bounties with 'yts' status where start time is today
            const bountiesToActivate = await Bounty.updateMany(
                {
                    status: 'yts',
                    startTime: {
                        $gte: todayStart,
                        $lte: todayEnd
                    }
                },
                {
                    $set: { status: 'active' }
                }
            );

            if (bountiesToActivate.modifiedCount > 0) {
                console.log(`Activated ${bountiesToActivate.modifiedCount} bounties scheduled for today`);
            } else {
                console.log('No bounties to activate for today');
            }
        } catch (error) {
            console.error('Error in daily bounty activation cron job:', error);
        }
    });

    // Add this to your config/cronJobs.js file
    cron.schedule('0 0 * * *', async () => {
        try {
            const currentTime = new Date();
            console.log('Running bounty closure check at midnight:', currentTime.toISOString());

            // Find active bounties where end time has passed
            const bountiesToClose = await Bounty.updateMany(
                {
                    status: 'active',
                    endTime: { $lte: currentTime }
                },
                {
                    $set: { status: 'closed' }
                }
            );

            if (bountiesToClose.modifiedCount > 0) {
                console.log(`Closed ${bountiesToClose.modifiedCount} bounties that ended today`);

                // You could also get the specific bounties to send notifications
                const closedBountyIds = await Bounty.find({
                    status: 'closed',
                    endTime: {
                        $gte: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000),
                        $lte: currentTime
                    }
                }).select('_id title');

                console.log('Closed bounties:', closedBountyIds);
            } else {
                console.log('No bounties to close today');
            }
        } catch (error) {
            console.error('Error in bounty closure cron job:', error);
        }
    });
};

module.exports = initCronJobs;