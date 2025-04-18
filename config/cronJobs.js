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
    cron.schedule('13 13 18 * *', async () => {
        try {
          const currentDate = new Date();
          console.log('Running monthly title revocation job on the 18th:', currentDate.toISOString());
      
          // Find all active (non-revoked) title awards that are past their validity period
          const expiredTitleAwards = await TitleAward.find({
            validUntil: { $lt: currentDate },
            isRevoked: false
          }).populate('hunter', 'name collegeEmail')
            .populate('title', 'name description');
      
          console.log(`Found ${expiredTitleAwards.length} expired title awards to revoke`);
      
          // Group by hunter for more efficient processing
          const hunterTitleMap = new Map();
          
          for (const award of expiredTitleAwards) {
            if (!award.hunter) continue; // Skip if hunter was deleted
            
            const hunterId = award.hunter._id.toString();
            
            if (!hunterTitleMap.has(hunterId)) {
              hunterTitleMap.set(hunterId, {
                hunter: award.hunter,
                awards: [],
                titleNames: []
              });
            }
            
            const hunterData = hunterTitleMap.get(hunterId);
            hunterData.awards.push(award);
            if (award.title && award.title.name) {
              hunterData.titleNames.push(award.title.name);
            }
          }
      
          console.log(`Affecting ${hunterTitleMap.size} hunters`);
          
          // Process each hunter in bulk
          let totalRevokedTitles = 0;
          
          for (const [hunterId, hunterData] of hunterTitleMap.entries()) {
            const { hunter, awards, titleNames } = hunterData;
            const titleIds = awards.map(award => award._id);
            
            // Mark all title awards as revoked in bulk
            await TitleAward.updateMany(
              { _id: { $in: titleIds } },
              {
                $set: {
                  isRevoked: true,
                  revokedAt: currentDate
                }
              }
            );
            
            // Update hunter's titles array
            // First get current hunter titles
            const hunterDoc = await Hunter.findById(hunterId).select('titles expiredTitles');
            
            if (!hunterDoc) continue;
            
            // Initialize expiredTitles array if it doesn't exist
            if (!hunterDoc.expiredTitles) {
              hunterDoc.expiredTitles = [];
            }
            
            // Filter out revoked titles from active titles and move to expired
            const titleAwardIds = awards.map(award => award._id.toString());
            const activeTitles = hunterDoc.titles.filter(title => {
              // Keep titles that aren't in our revoked list
              if (!titleAwardIds.includes(title.title.toString())) {
                return true;
              }
              
              // Move this title to expired
              hunterDoc.expiredTitles.push({
                ...title.toObject(),
                revokedAt: currentDate
              });
              
              return false;
            });
            
            // Update the hunter document
            hunterDoc.titles = activeTitles;
            await hunterDoc.save();
            
            totalRevokedTitles += awards.length;
            
            // Only send notification if there are actually titles being revoked
            if (titleNames.length > 0) {
              try {
                // Send notification email
                await transporter.sendMail({
                  from: process.env.EMAIL_USER,
                  to: hunter.collegeEmail,
                  subject: 'Your Titles Have Expired',
                  text: `
      Hello ${hunter.name},
      
      This is to inform you that the following title(s) have expired from your profile:
      ${titleNames.map(name => `- ${name}`).join('\n')}
      
      Titles are awarded for specific periods and need to be renewed or earned again. Keep participating in bounties to earn more titles!
      
      Best regards,
      The Bounty Hunter Platform Team
                  `
                });
              } catch (emailError) {
                console.error(`Error sending email to hunter ${hunterId}:`, emailError);
              }
      
              try {
                // Create in-app notification
                await notificationController.createNotification({
                  hunterId: hunterId,
                  title: 'Titles Expired',
                  message: `${titleNames.length} title(s) have expired from your profile: ${titleNames.join(', ')}`,
                  type: 'system'
                });
              } catch (notifError) {
                console.error(`Error creating notification for hunter ${hunterId}:`, notifError);
              }
            }
          }
      
          console.log(`Successfully revoked ${totalRevokedTitles} titles affecting ${hunterTitleMap.size} hunters`);
      
        } catch (error) {
          console.error('Error in monthly title revocation job:', error);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // For IST
      });
};

module.exports = initCronJobs;