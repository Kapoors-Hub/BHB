// config/cronJobs.js
const cron = require('node-cron');
const Bounty = require('../models/Bounty');
const Hunter = require('../models/Hunter');
const Title = require('../models/Title');
const transporter = require('../config/mailer');
const notificationController = require('../controllers/notificationController');
const TitleAward = require('../models/TitleAward');

const initCronJobs = () => {
    // Add this to your config/cronJobs.js file
    cron.schedule('18 03 * * *', async () => {
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
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // For IST
    });

    // Add this to your config/cronJobs.js file
    cron.schedule('22 03 * * *', async () => {
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
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // For IST
    });

    // Add to config/cronJobs.js
    cron.schedule('51 12 11 * *', async () => {
        try {
            const currentDate = new Date();
            console.log('Running monthly title revocation job on the 7th:', currentDate.toISOString());

            // Find all hunters with titles
            const hunters = await Hunter.find({
                'titles.0': { $exists: true } // At least one title exists
            }).select('name collegeEmail titles');

            console.log(`Found ${hunters.length} hunters with titles to revoke`);

            // Process each hunter
            let totalRevokedTitles = 0;

            for (const hunter of hunters) {
                if (!hunter.titles || hunter.titles.length === 0) continue;

                // Collect titles for tracking
                const titleIds = hunter.titles.map(title => title.title);
                const titleInfo = await Title.find({ _id: { $in: titleIds } })
                    .select('name');

                const titleNames = titleInfo.map(t => t.name);
                totalRevokedTitles += hunter.titles.length;

                // Create an expiredTitles array if it doesn't exist
                if (!hunter.expiredTitles) {
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        { $set: { expiredTitles: [] } }
                    );
                }

                // Move all titles to expiredTitles
                await Hunter.findByIdAndUpdate(
                    hunter._id,
                    {
                        $push: {
                            expiredTitles: {
                                $each: hunter.titles.map(title => ({
                                    ...title.toObject(),
                                    revokedAt: currentDate
                                }))
                            }
                        },
                        $set: { titles: [] } // Clear active titles
                    }
                );

                // Update TitleAward entries to mark them as revoked
                for (const title of hunter.titles) {
                    await TitleAward.updateMany(
                        {
                            hunter: hunter._id,
                            title: title.title,
                            isRevoked: false
                        },
                        {
                            $set: {
                                isRevoked: true,
                                revokedAt: currentDate
                            }
                        }
                    );
                }

                // Send notification email
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: hunter.collegeEmail,
                    subject: 'Your Titles Have Been Revoked',
                    text: `
Hello ${hunter.name},

This is to inform you that the following title(s) have been revoked from your profile:
${titleNames.map(name => `- ${name}`).join('\n')}

Titles are awarded for specific periods and need to be renewed or earned again. Keep participating in bounties to earn more titles!

Best regards,
The Bounty Hunter Platform Team
                `
                });

                // Create in-app notification
                await notificationController.createNotification({
                    hunterId: hunter._id,
                    title: 'Titles Revoked',
                    message: `${hunter.titles.length} title(s) have been revoked from your profile: ${titleNames.join(', ')}`,
                    type: 'system'
                });
            }

            console.log(`Successfully revoked ${totalRevokedTitles} titles from ${hunters.length} hunters`);

        } catch (error) {
            console.error('Error in monthly title revocation job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // For IST
    });
};

module.exports = initCronJobs;