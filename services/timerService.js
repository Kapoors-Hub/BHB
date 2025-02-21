// services/timerService.js
const Bounty = require('../models/Bounty');

const activeLordTimers = new Map();

const handleLordBountyUpdates = async (ws, lordId) => {
    if (activeLordTimers.has(lordId)) {
        clearInterval(activeLordTimers.get(lordId));
    }

    const timer = setInterval(async () => {
        try {
            const currentTime = new Date();
            
            // Get all bounties for this lord
            const bounties = await Bounty.find({ 
                createdBy: lordId,
                status: { $in: ['draft', 'active', 'completed'] }  // Added 'completed' to track result time
            });

            for (const bounty of bounties) {
                // Check for start time
                if (bounty.status === 'draft' && currentTime >= bounty.startTime) {
                    await Bounty.findByIdAndUpdate(bounty._id, { status: 'active' });
                    
                    ws.send(JSON.stringify({
                        type: 'bounty_started',
                        bountyId: bounty._id,
                        title: bounty.title,
                        message: `Your bounty "${bounty.title}" is now live!`,
                        timeLeft: {
                            endTime: bounty.endTime,
                            remainingTime: bounty.endTime - currentTime
                        }
                    }));
                }
                
                // Check for end time
                if (bounty.status === 'active' && currentTime >= bounty.endTime) {
                    await Bounty.findByIdAndUpdate(bounty._id, { status: 'completed' });
                    
                    ws.send(JSON.stringify({
                        type: 'bounty_ended',
                        bountyId: bounty._id,
                        title: bounty.title,
                        message: `Your bounty "${bounty.title}" has ended!`,
                        participants: bounty.currentHunters,
                        resultTimeLeft: {
                            resultTime: bounty.resultTime,
                            remainingTime: bounty.resultTime - currentTime
                        }
                    }));
                }

                // If bounty is active, send time remaining until end
                if (bounty.status === 'active') {
                    const timeUntilEnd = bounty.endTime - currentTime;
                    if (timeUntilEnd > 0) {
                        ws.send(JSON.stringify({
                            type: 'bounty_time_update',
                            bountyId: bounty._id,
                            title: bounty.title,
                            timeRemaining: {
                                hours: Math.floor(timeUntilEnd / (1000 * 60 * 60)),
                                minutes: Math.floor((timeUntilEnd % (1000 * 60 * 60)) / (1000 * 60)),
                                seconds: Math.floor((timeUntilEnd % (1000 * 60)) / 1000)
                            }
                        }));
                    }
                }

                // NEW: If bounty is completed, send time remaining until result
                if (bounty.status === 'completed' && currentTime < bounty.resultTime) {
                    const timeUntilResult = bounty.resultTime - currentTime;
                    ws.send(JSON.stringify({
                        type: 'result_time_update',
                        bountyId: bounty._id,
                        title: bounty.title,
                        message: 'Time remaining for result declaration',
                        timeRemaining: {
                            hours: Math.floor(timeUntilResult / (1000 * 60 * 60)),
                            minutes: Math.floor((timeUntilResult % (1000 * 60 * 60)) / (1000 * 60)),
                            seconds: Math.floor((timeUntilResult % (1000 * 60)) / 1000)
                        }
                    }));
                }

                // When result time is reached
                if (bounty.status === 'completed' && currentTime >= bounty.resultTime) {
                    await Bounty.findByIdAndUpdate(bounty._id, { status: 'cancelled' });
                    
                    ws.send(JSON.stringify({
                        type: 'result_time_reached',
                        bountyId: bounty._id,
                        title: bounty.title,
                        message: `Result time reached for bounty "${bounty.title}"!`,
                        participants: bounty.currentHunters
                    }));
                }
            }
        } catch (error) {
            console.error('Error in lord bounty updates:', error);
        }
    }, 1000);

    activeLordTimers.set(lordId, timer);

    // Cleanup when connection closes
    ws.on('close', () => {
        if (activeLordTimers.has(lordId)) {
            clearInterval(activeLordTimers.get(lordId));
            activeLordTimers.delete(lordId);
        }
    });
};

module.exports = { handleLordBountyUpdates };