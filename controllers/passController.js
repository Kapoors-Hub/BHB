// controllers/passController.js
const Hunter = require('../models/Hunter');
const { PassType, HunterPass, PassUsage, PassReset } = require('../models/Pass');
const FoulRecord = require('../models/FoulRecord');
const Bounty = require('../models/Bounty');
const mongoose = require('mongoose');
const notificationController = require('./notificationController');
const passController = {
    
    // Get hunter's passes
    // async getHunterPasses(req, res) {
    //     try {
    //         const hunterId = req.hunter.id;
            
    //         const hunter = await Hunter.findById(hunterId);
    //         if (!hunter) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found'
    //             });
    //         }
            
    //         // Get pass usage history
    //         const passHistory = await Pass.find({ hunter: hunterId })
    //             .populate('relatedBounty', 'title')
    //             .populate('relatedFoul', 'name')
    //             .sort({ usedAt: -1 });
                
    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Passes retrieved successfully',
    //             data: {
    //                 availablePasses: {
    //                     timeExtension: hunter.passes.timeExtension.count,
    //                     resetFoul: hunter.passes.resetFoul.count,
    //                     booster: hunter.passes.booster.count,
    //                     seasonal: hunter.passes.seasonal.count
    //                 },
    //                 consecutiveWins: hunter.passes.consecutiveWins,
    //                 passHistory
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error retrieving passes',
    //             error: error.message
    //         });
    //     }
    // },
    
    // Use time extension pass
    // async useTimeExtensionPass(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const hunterId = req.hunter.id;
            
    //         const hunter = await Hunter.findById(hunterId);
    //         if (!hunter) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found'
    //             });
    //         }
            
    //         // Check if hunter has a time extension pass
    //         if (hunter.passes.timeExtension.count <= 0) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'No time extension passes available'
    //             });
    //         }
            
    //         // Check if hunter is participating in the bounty
    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             'participants.hunter': hunterId
    //         });
            
    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found or you are not a participant'
    //             });
    //         }
            
    //         // Check if bounty is active
    //         if (bounty.status !== 'active') {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Time extension can only be used for active bounties'
    //             });
    //         }
            
    //         // Use the pass
    //         await Hunter.findByIdAndUpdate(hunterId, {
    //             $inc: { 'passes.timeExtension.count': -1 }
    //         });
            
    //         // Create pass usage record
    //         const effectUntil = new Date(bounty.endTime);
    //         effectUntil.setHours(effectUntil.getHours() + 24); // 24-hour extension
            
    //         const passRecord = await Pass.create({
    //             hunter: hunterId,
    //             passType: 'timeExtension',
    //             relatedBounty: bountyId,
    //             status: 'active',
    //             effectUntil
    //         });
            
    //         // Update bounty for this hunter to extend deadline
    //         await Bounty.findOneAndUpdate(
    //             { 
    //                 _id: bountyId,
    //                 'participants.hunter': hunterId
    //             },
    //             {
    //                 $set: {
    //                     'participants.$.extendedEndTime': effectUntil
    //                 }
    //             }
    //         );
            
    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Time extension pass used successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 extendedUntil: effectUntil,
    //                 remainingPasses: hunter.passes.timeExtension.count - 1
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error using time extension pass',
    //             error: error.message
    //         });
    //     }
    // },
    
    // Use reset foul pass
    // async useResetFoulPass(req, res) {
    //     try {
    //         const { foulRecordId } = req.params;
    //         const hunterId = req.hunter.id;
            
    //         const hunter = await Hunter.findById(hunterId);
    //         if (!hunter) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found'
    //             });
    //         }
            
    //         // Check if hunter has a reset foul pass
    //         if (hunter.passes.resetFoul.count <= 0) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'No reset foul passes available'
    //             });
    //         }
            
    //         // Check if foul record exists and belongs to hunter
    //         const foulRecord = await FoulRecord.findOne({
    //             _id: foulRecordId,
    //             hunter: hunterId
    //         }).populate('foul', 'name xpPenaltyPercentage');
            
    //         if (!foulRecord) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Foul record not found or does not belong to you'
    //             });
    //         }
            
    //         // Use the pass
    //         await Hunter.findByIdAndUpdate(hunterId, {
    //             $inc: { 
    //                 'passes.resetFoul.count': -1,
    //                 'xp': foulRecord.xpPenalty // Restore the XP that was deducted
    //             }
    //         });
            
    //         // Mark foul as reset
    //         await FoulRecord.findByIdAndUpdate(foulRecordId, {
    //             $set: {
    //                 reset: true,
    //                 resetDate: new Date()
    //             }
    //         });
            
    //         // Create pass usage record
    //         const passRecord = await Pass.create({
    //             hunter: hunterId,
    //             passType: 'resetFoul',
    //             relatedFoul: foulRecordId,
    //             status: 'completed'
    //         });
            
    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Foul reset pass used successfully',
    //             data: {
    //                 foulName: foulRecord.foul.name,
    //                 xpRestored: foulRecord.xpPenalty,
    //                 remainingPasses: hunter.passes.resetFoul.count - 1
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error using reset foul pass',
    //             error: error.message
    //         });
    //     }
    // },
    
    // Use booster pass
    // async useBoosterPass(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const hunterId = req.hunter.id;
            
    //         const hunter = await Hunter.findById(hunterId);
    //         if (!hunter) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found'
    //             });
    //         }
            
    //         // Check if hunter has a booster pass
    //         if (hunter.passes.booster.count <= 0) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'No booster passes available'
    //             });
    //         }
            
    //         // Check if hunter is participating in the bounty
    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             'participants.hunter': hunterId
    //         });
            
    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found or you are not a participant'
    //             });
    //         }
            
    //         // Check if bounty is active (can only use before completion)
    //         if (bounty.status !== 'active') {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Booster pass can only be used for active bounties'
    //             });
    //         }
            
    //         // Use the pass
    //         await Hunter.findByIdAndUpdate(hunterId, {
    //             $inc: { 'passes.booster.count': -1 }
    //         });
            
    //         // Create pass usage record
    //         const passRecord = await Pass.create({
    //             hunter: hunterId,
    //             passType: 'booster',
    //             relatedBounty: bountyId,
    //             status: 'active'
    //         });
            
    //         // Update bounty participant to mark booster active
    //         await Bounty.findOneAndUpdate(
    //             { 
    //                 _id: bountyId,
    //                 'participants.hunter': hunterId
    //             },
    //             {
    //                 $set: {
    //                     'participants.$.boosterActive': true
    //                 }
    //             }
    //         );
            
    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Booster pass activated successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 xpBoostPercentage: 25, // 125% of normal XP
    //                 remainingPasses: hunter.passes.booster.count - 1
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error using booster pass',
    //             error: error.message
    //         });
    //     }
    // },
    
    // Award passes based on bounty results
    async awardPassesForBounty(bountyId) {
        try {
            const bounty = await Bounty.findById(bountyId)
                .populate('participants.hunter');
                
            if (!bounty || bounty.status !== 'completed') {
                return;
            }
            
            // Get all reviewed submissions
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission && p.submission.review
            );
            
            // Sort by score
            const sortedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );
            
            // Award Reset Foul pass to the winner
            if (sortedParticipants.length > 0) {
                const winner = sortedParticipants[0];
                
                // Update winner's consecutive wins and award passes
                const hunter = await Hunter.findById(winner.hunter._id);
                
                // Increment consecutive wins
                const newConsecutiveWins = hunter.passes.consecutiveWins + 1;
                
                // Update passes
                await Hunter.findByIdAndUpdate(winner.hunter._id, {
                    $inc: { 
                        'passes.resetFoul.count': 1, // Award 1 Reset Foul pass for winning
                        'passes.consecutiveWins': 1
                    }
                });
                
                // If they now have 2 consecutive wins, award a Booster pass
                if (newConsecutiveWins >= 2) {
                    await Hunter.findByIdAndUpdate(winner.hunter._id, {
                        $inc: { 'passes.booster.count': 1 }, // Award 1 Booster pass
                        $set: { 'passes.consecutiveWins': 0 } // Reset consecutive wins counter
                    });
                }
            }
        } catch (error) {
            console.error('Error awarding passes for bounty:', error);
        }
    },
    
    // Monthly reset for time extension passes
    async resetMonthlyPasses() {
        try {
            const currentDate = new Date();
            const lastMonth = new Date(currentDate);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            
            // Find hunters whose passes haven't been reset this month
            const hunters = await Hunter.find({
                'passes.timeExtension.lastResetDate': { $lt: lastMonth }
            });
            
            // Reset time extension passes
            for (const hunter of hunters) {
                await Hunter.findByIdAndUpdate(hunter._id, {
                    $inc: { 'passes.timeExtension.count': 1 }, // Add one pass
                    $set: { 'passes.timeExtension.lastResetDate': currentDate }
                });
            }
            
            console.log(`Reset monthly passes for ${hunters.length} hunters`);
        } catch (error) {
            console.error('Error resetting monthly passes:', error);
        }
    },
    
    // Award seasonal passes to top performers
    async awardSeasonalPasses(req, res) {
        try {
            const { topHunterIds } = req.body;
            const adminId = req.admin.id;
            
            if (!Array.isArray(topHunterIds) || topHunterIds.length === 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Top hunter IDs must be a non-empty array'
                });
            }
            
            // Award seasonal passes to top hunters
            const updatedHunters = [];
            
            for (const hunterId of topHunterIds) {
                const hunter = await Hunter.findById(hunterId);
                
                if (hunter) {
                    // Award one of each pass
                    await Hunter.findByIdAndUpdate(hunterId, {
                        $inc: { 
                            'passes.timeExtension.count': 1,
                            'passes.resetFoul.count': 1,
                            'passes.booster.count': 1,
                            'passes.seasonal.count': 1
                        },
                        $set: { 'passes.seasonal.lastAwarded': new Date() }
                    });
                    
                    updatedHunters.push({
                        id: hunter._id,
                        name: hunter.name,
                        username: hunter.username
                    });
                }
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Seasonal passes awarded successfully',
                data: {
                    awardedTo: updatedHunters
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error awarding seasonal passes',
                error: error.message
            });
        }
    },

    // Award pass to hunter
async awardPassToHunter(req, res) {
    try {
      const { hunterId } = req.params;
      const { passType, count, reason } = req.body;
      const adminId = req.admin.id;
  
      // Validate inputs
      if (!passType || !['timeExtension', 'resetFoul', 'booster', 'seasonal'].includes(passType)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid pass type is required (timeExtension, resetFoul, booster, seasonal)'
        });
      }
  
      if (!count || isNaN(count) || count <= 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid pass count is required'
        });
      }
  
      // Check if hunter exists
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Prepare update object
      const updateField = `passes.${passType}.count`;
      const update = { $inc: {} };
      update.$inc[updateField] = count;
  
      // Update hunter passes
      const updatedHunter = await Hunter.findByIdAndUpdate(
        hunterId,
        update,
        { new: true }
      );
  
      // Create a pass usage record
      await Pass.create({
        hunter: hunterId,
        passType,
        count,
        status: 'awarded',
        awardedBy: adminId,
        awardReason: reason || 'Administrative award'
      });
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Passes Awarded',
        message: `You've been awarded ${count} ${passType} pass${count > 1 ? 'es' : ''}${reason ? ` for: ${reason}` : ''}.`,
        type: 'pass'
      });
  
      // Log the action
      console.log(`Admin ${adminId} awarded ${count} ${passType} passes to hunter ${hunterId}`);
  
      // Format pass type for display
      const formattedPassType = passType
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: `${formattedPassType} pass${count > 1 ? 'es' : ''} awarded successfully`,
        data: {
          hunter: {
            id: updatedHunter._id,
            name: updatedHunter.name,
            username: updatedHunter.username
          },
          passType,
          count,
          newTotal: updatedHunter.passes[passType].count
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error awarding passes',
        error: error.message
      });
    }
  },
  
  // Remove passes from hunter
  async removePassFromHunter(req, res) {
    try {
      const { hunterId, passType } = req.params;
      const { count, reason } = req.body;
      const adminId = req.admin.id;
  
      // Validate pass type
      if (!['timeExtension', 'resetFoul', 'booster', 'seasonal'].includes(passType)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid pass type is required (timeExtension, resetFoul, booster, seasonal)'
        });
      }
  
      // Validate count
      if (!count || isNaN(count) || count <= 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid pass count is required'
        });
      }
  
      // Check if hunter exists
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Check if hunter has enough passes
      if (hunter.passes[passType].count < count) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: `Hunter only has ${hunter.passes[passType].count} ${passType} passes`
        });
      }
  
      // Prepare update object
      const updateField = `passes.${passType}.count`;
      const update = { $inc: {} };
      update.$inc[updateField] = -count;
  
      // Update hunter passes
      const updatedHunter = await Hunter.findByIdAndUpdate(
        hunterId,
        update,
        { new: true }
      );
  
      // Create a pass usage record
      await Pass.create({
        hunter: hunterId,
        passType,
        count: -count,
        status: 'removed',
        awardedBy: adminId,
        awardReason: reason || 'Administrative removal'
      });
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Passes Removed',
        message: `${count} ${passType} pass${count > 1 ? 'es have' : ' has'} been removed from your account${reason ? ` for: ${reason}` : ''}.`,
        type: 'pass'
      });
  
      // Log the action
      console.log(`Admin ${adminId} removed ${count} ${passType} passes from hunter ${hunterId}`);
  
      // Format pass type for display
      const formattedPassType = passType
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: `${formattedPassType} pass${count > 1 ? 'es' : ''} removed successfully`,
        data: {
          hunter: {
            id: updatedHunter._id,
            name: updatedHunter.name,
            username: updatedHunter.username
          },
          passType,
          count,
          remainingTotal: updatedHunter.passes[passType].count
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error removing passes',
        error: error.message
      });
    }
  },
  
  //Use Reset Foul Pass
  async useResetFoulPass(req, res) {
    try {
        const { foulRecordId } = req.params;
        const hunterId = req.hunter.id;

        // Find hunter
        const hunter = await Hunter.findById(hunterId);
        if (!hunter) {
            return res.status(404).json({
                status: 404, 
                success: false,
                message: 'Hunter not found'
            });
        }

        // Check if hunter has any Clean Slate passes
        if (!hunter.passes || hunter.passes.resetFoul.count <= 0) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'No Clean Slate passes available'
            });
        }

        // Find the foul record
        const foulRecord = await FoulRecord.findOne({
            _id: foulRecordId,
            hunter: hunterId,
            isStrike: true
        });

        if (!foulRecord) {
            return res.status(404).json({
                status: 404,
                success: false, 
                message: 'Strike foul record not found'
            });
        }

        // Mark foul as cleared by pass
        foulRecord.clearedByPass = true;
        foulRecord.clearedAt = new Date();
        await foulRecord.save();

        // Reduce strike count and use pass
        await Hunter.findByIdAndUpdate(
            hunterId,
            {
                $inc: {
                    'strikes.count': -1,
                    'passes.resetFoul.count': -1
                }
            }
        );

        // Create notification
        await notificationController.createNotification({
            hunterId: hunterId,
            title: 'Strike Removed',
            message: `You have used a Clean Slate Pass to remove a strike. Your current strike count is now ${hunter.strikes.count - 1}.`,
            type: 'system'
        });

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Clean Slate Pass used successfully',
            data: {
                remainingPasses: hunter.passes.resetFoul.count - 1,
                newStrikeCount: hunter.strikes.count - 1,
                clearedFoul: {
                    id: foulRecord._id,
                    name: foulRecord.foul.name
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error using Clean Slate Pass',
            error: error.message
        });
    }
},

/**
 * Controller function for hunters to use Clean Slate pass
 * to remove a foul from their record
 */
// async useCleanSlatePass(req, res) {
//     // Start a session outside the try/catch to ensure we can access it in all code blocks
//     const session = await mongoose.startSession();
    
//     try {
//       const hunterId = req.hunter.id;
//       const { foulRecordId } = req.params;
      
//       // Validate foul record exists and belongs to this hunter
//       const foulRecord = await FoulRecord.findOne({
//         _id: foulRecordId,
//         hunter: hunterId
//       });
      
//       if (!foulRecord) {
//         return res.status(404).json({
//           status: 404,
//           success: false,
//           message: 'Foul record not found or does not belong to you'
//         });
//       }
      
//       // Check if the foul is already cleared
//       if (foulRecord.isCleared) {
//         return res.status(400).json({
//           status: 400,
//           success: false,
//           message: 'This foul has already been cleared'
//         });
//       }
      
//       // Check if hunter has a clean slate pass to use (new system)
//       const hunterPass = await HunterPass.findOne({
//         hunter: hunterId,
//         passType: 'cleanSlate'
//       });
      
//     //   const legacyHunter = await Hunter.findById(hunterId);
      
//       // Check available passes in both systems
//     //   const hasLegacyPass = legacyHunter && legacyHunter.passes.resetFoul.count > 0;
//       const hasNewPass = hunterPass && hunterPass.count > 0;
      
//       if (!hasNewPass) {
//         return res.status(400).json({
//           status: 400,
//           success: false,
//           message: 'You do not have any Clean Slate passes to use'
//         });
//       }
      
//       // Begin transaction
//       session.startTransaction();
      
//       // Mark the foul as cleared
//       foulRecord.isCleared = true;
//       foulRecord.clearedAt = new Date();
//       foulRecord.clearedBy = {
//         id: hunterId,
//         role: 'Hunter'
//       };
//       await foulRecord.save({ session });
      
//       // If the foul had a strike, reduce strike count
//       if (foulRecord.isStrike) {
//         await Hunter.findByIdAndUpdate(
//           hunterId,
//           { $inc: { 'strikes.count': -1 } },
//           { session }
//         );
//       }
      
//       // Deduct pass from hunter's inventory (both systems)
//       if (hasNewPass) {
//         await HunterPass.updateOne(
//           { _id: hunterPass._id },
//           { 
//             $inc: { count: -1 },
//             $set: { lastUpdated: new Date() }
//           },
//           { session }
//         );
//       }
      
//     //   if (hasLegacyPass) {
//     //     await Hunter.findByIdAndUpdate(
//     //       hunterId,
//     //       { $inc: { 'passes.resetFoul.count': -1 } },
//     //       { session }
//     //     );
//     //   }
      
//       // Record the pass usage
//       await PassUsage.create([{
//         hunter: hunterId,
//         passType: 'cleanSlate',
//         usedAt: new Date(),
//         foulRecord: foulRecordId,
//         effect: {
//           foulCleared: true
//         }
//       }], { session });
      
//       // Commit the transaction
//       await session.commitTransaction();
      
//       // Create notification about the pass usage
//       await notificationController.createNotification({
//         hunterId: hunterId,
//         title: 'Clean Slate Pass Used',
//         message: `You've successfully used a Clean Slate Pass to clear a foul from your record.`,
//         type: 'system'
//       });
      
//       return res.status(200).json({
//         status: 200,
//         success: true,
//         message: 'Clean Slate Pass used successfully to clear foul',
//         data: {
//           foulRecord: {
//             id: foulRecord._id,
//             reason: foulRecord.reason,
//             clearedAt: foulRecord.clearedAt
//           },
//           remainingPasses: (hasNewPass ? hunterPass.count : legacyHunter.passes.resetFoul.count) - 1
//         }
//       });
//     } catch (error) {
//       // If an error occurs during the transaction, abort it
//       if (session.inTransaction()) {
//         await session.abortTransaction();
//       }
      
//       return res.status(500).json({
//         status: 500,
//         success: false,
//         message: 'Error using Clean Slate Pass',
//         error: error.message
//       });
//     } finally {
//       // Always end the session
//       session.endSession();
//     }
//   },

async useCleanSlatePass(req, res) {
    // Start a session outside the try/catch to ensure we can access it in all code blocks
    const session = await mongoose.startSession();
    
    try {
      const hunterId = req.hunter.id;
      const { foulRecordId } = req.params;
      
      // Validate foul record exists and belongs to this hunter
      const foulRecord = await FoulRecord.findOne({
        _id: foulRecordId,
        hunter: hunterId
      });
      
      if (!foulRecord) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Foul record not found or does not belong to you'
        });
      }
      
      // Check if the foul is already cleared
      if (foulRecord.isCleared) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'This foul has already been cleared'
        });
      }
      
      // Check if hunter has a clean slate pass to use
      const hunterPass = await HunterPass.findOne({
        hunter: hunterId,
        passType: 'cleanSlate'
      });
      
      // Check available passes
      const hasPass = hunterPass && hunterPass.count > 0;
      
      if (!hasPass) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You do not have any Clean Slate passes to use'
        });
      }
      
      // Begin transaction
      session.startTransaction();
      
      // Mark the foul as cleared
      foulRecord.isCleared = true;
      foulRecord.clearedAt = new Date();
      foulRecord.clearedBy = {
        id: hunterId,
        role: 'Hunter'
      };
      await foulRecord.save({ session });
      
      // If the foul had a strike, reduce strike count
      if (foulRecord.isStrike) {
        await Hunter.findByIdAndUpdate(
          hunterId,
          { $inc: { 'strikes.count': -1 } },
          { session }
        );
      }
      
      // Deduct pass from hunter's inventory
      await HunterPass.updateOne(
        { _id: hunterPass._id },
        { 
          $inc: { count: -1 },
          $set: { lastUpdated: new Date() }
        },
        { session }
      );
      
      // Record the pass usage
      await PassUsage.create([{
        hunter: hunterId,
        passType: 'cleanSlate',
        usedAt: new Date(),
        foulRecord: foulRecordId,
        effect: {
          foulCleared: true
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Create notification about the pass usage
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Clean Slate Pass Used',
        message: `You've successfully used a Clean Slate Pass to clear a foul from your record.`,
        type: 'system'
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Clean Slate Pass used successfully to clear foul',
        data: {
          foulRecord: {
            id: foulRecord._id,
            reason: foulRecord.reason,
            clearedAt: foulRecord.clearedAt
          },
          remainingPasses: hunterPass.count - 1
        }
      });
    } catch (error) {
      // If an error occurs during the transaction, abort it
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error using Clean Slate Pass',
        error: error.message
      });
    } finally {
      // Always end the session
      session.endSession();
    }
  },

  /**
 * Controller function to get a hunter's passes
 */
async getHunterPasses(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Get pass types for descriptions
      const passTypes = await PassType.find({ active: true });
      
      // Create a map of pass types for easy lookup
      const passTypeMap = {};
      passTypes.forEach(passType => {
        passTypeMap[passType.name] = {
          displayName: passType.displayName,
          description: passType.description,
          effectDuration: passType.effectDuration,
          boostPercentage: passType.boostPercentage
        };
      });
      
      // Get hunter passes from the new system
      const hunterPasses = await HunterPass.find({ hunter: hunterId });
      
      // Get hunter for legacy pass data
      const hunter = await Hunter.findById(hunterId);
      
      // Combine data from both systems
      const combinedPasses = [
        {
          type: 'timeExtension',
          passType: 'timeExtension',
          displayName: passTypeMap.timeExtension?.displayName || 'Time Extension Pass',
          description: passTypeMap.timeExtension?.description || 'Extend a bounty deadline by 12 hours',
          count: Math.max(
            hunter?.passes?.timeExtension?.count || 0,
            hunterPasses.find(p => p.passType === 'timeExtension')?.count || 0
          ),
          effectDuration: passTypeMap.timeExtension?.effectDuration || 12
        },
        {
          type: 'cleanSlate',
          passType: 'cleanSlate',
          displayName: passTypeMap.cleanSlate?.displayName || 'Clean Slate Pass',
          description: passTypeMap.cleanSlate?.description || 'Clears one foul from your record',
          count: Math.max(
            hunter?.passes?.resetFoul?.count || 0,
            hunterPasses.find(p => p.passType === 'cleanSlate')?.count || 0
          )
        },
        {
          type: 'booster',
          passType: 'booster',
          displayName: passTypeMap.booster?.displayName || 'Booster Pass',
          description: passTypeMap.booster?.description || 'Get 1.25x XP on a bounty you participate in!',
          count: Math.max(
            hunter?.passes?.booster?.count || 0,
            hunterPasses.find(p => p.passType === 'booster')?.count || 0
          ),
          boostPercentage: passTypeMap.booster?.boostPercentage || 25
        },
        {
          type: 'seasonal',
          passType: 'seasonal',
          displayName: passTypeMap.seasonal?.displayName || 'Seasonal Pass',
          description: passTypeMap.seasonal?.description || 'Claim it in the next season!',
          count: Math.max(
            hunter?.passes?.seasonal?.count || 0,
            hunterPasses.find(p => p.passType === 'seasonal')?.count || 0
          )
        }
      ];
      
      // Get hunter's consecutive wins for booster pass progress
      const consecutiveWins = hunter?.passes?.consecutiveWins || 0;
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Hunter passes retrieved successfully',
        data: {
          passes: combinedPasses,
          consecutiveWinsProgress: {
            current: consecutiveWins,
            required: 2,
            percentage: Math.min(100, (consecutiveWins / 2) * 100)
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving hunter passes',
        error: error.message
      });
    }
  },
  
 /**
 * Controller function for hunters to use Time Extension pass
 * to extend a bounty deadline
 */
async useTimeExtensionPass(req, res) {
    // Start a session for transaction
    const session = await mongoose.startSession();
    
    try {
      const hunterId = req.hunter.id;
      const { bountyId } = req.params;
      
      // Validate bounty exists
      const bounty = await Bounty.findById(bountyId);
      
      if (!bounty) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Bounty not found'
        });
      }
      
      // Check if bounty is active
      if (bounty.status !== 'active') {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Time extension can only be applied to active bounties'
        });
      }
      
      // Verify hunter is participating in this bounty
      const participation = bounty.participants.find(
        p => p.hunter.toString() === hunterId
      );
      
      if (!participation) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You are not participating in this bounty'
        });
      }
      
      // Check if hunter has already used time extension on this bounty
      if (participation.extendedEndTime) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You have already used a time extension pass on this bounty'
        });
      }
      
      // Check if hunter has a time extension pass to use (new system)
      const hunterPass = await HunterPass.findOne({
        hunter: hunterId,
        passType: 'timeExtension'
      });
      
      const legacyHunter = await Hunter.findById(hunterId);
      
      // Check available passes in both systems
      const hasLegacyPass = legacyHunter && legacyHunter.passes.timeExtension.count > 0;
      const hasNewPass = hunterPass && hunterPass.count > 0;
      
      if (!hasLegacyPass && !hasNewPass) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You do not have any Time Extension passes to use'
        });
      }
      
      // Get pass type to determine effect duration
      const passType = await PassType.findOne({ name: 'timeExtension' });
      const extensionHours = passType?.effectDuration || 12; // Default to 12 hours if not specified
      
      // Begin transaction
      session.startTransaction();
      
      // Calculate the extended end time for this hunter
      const now = new Date();
      let personalEndTime;
      
      // If original end time has passed, extend from current time
      if (now > bounty.endTime) {
        personalEndTime = new Date(now.getTime() + (extensionHours * 60 * 60 * 1000));
      } else {
        // Otherwise extend from original end time
        personalEndTime = new Date(bounty.endTime.getTime() + (extensionHours * 60 * 60 * 1000));
      }
      
      // Update the hunter's participation record with extended end time
      await Bounty.updateOne(
        { 
          _id: bountyId,
          "participants.hunter": hunterId
        },
        { 
          $set: { "participants.$.extendedEndTime": personalEndTime }
        },
        { session }
      );
      
      // Deduct pass from hunter's inventory (both systems)
      if (hasNewPass) {
        await HunterPass.updateOne(
          { _id: hunterPass._id },
          { 
            $inc: { count: -1 },
            $set: { lastUpdated: new Date() }
          },
          { session }
        );
      }
      
      if (hasLegacyPass) {
        await Hunter.findByIdAndUpdate(
          hunterId,
          { $inc: { 'passes.timeExtension.count': -1 } },
          { session }
        );
      }
      
      // Record the pass usage
      await PassUsage.create([{
        hunter: hunterId,
        passType: 'timeExtension',
        usedAt: new Date(),
        bounty: bountyId,
        effect: {
          extendedHours: extensionHours
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Format dates for display
      const originalEndTime = bounty.endTime;
      const formattedOriginalEnd = originalEndTime.toLocaleString();
      const formattedExtendedEnd = personalEndTime.toLocaleString();
      
      // Create notification about the pass usage
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Time Extension Pass Used',
        message: `You've used a Time Extension Pass to extend your deadline for "${bounty.title}" by ${extensionHours} hours.`,
        type: 'system',
        relatedItem: bountyId,
        itemModel: 'Bounty'
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Time Extension Pass used successfully',
        data: {
          bounty: {
            id: bounty._id,
            title: bounty.title
          },
          timeExtension: {
            originalEndTime: originalEndTime,
            extendedEndTime: personalEndTime,
            extensionHours: extensionHours
          },
          remainingPasses: (hasNewPass ? hunterPass.count : legacyHunter.passes.timeExtension.count) - 1
        }
      });
    } catch (error) {
      // If an error occurs during the transaction, abort it
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error using Time Extension Pass',
        error: error.message
      });
    } finally {
      // Always end the session
      session.endSession();
    }
  },

  /**
 * Controller function for hunters to use Booster pass
 * to increase XP gain from a bounty
 */
async useBoosterPass(req, res) {
    // Start a session for transaction
    const session = await mongoose.startSession();
    
    try {
      const hunterId = req.hunter.id;
      const { bountyId } = req.params;
      
      // Validate bounty exists
      const bounty = await Bounty.findById(bountyId);
      
      if (!bounty) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Bounty not found'
        });
      }
      
      // Check if bounty is active
      if (bounty.status !== 'active') {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Booster pass can only be applied to active bounties'
        });
      }
      
      // Verify hunter is participating in this bounty
      const participantIndex = bounty.participants.findIndex(
        p => p.hunter.toString() === hunterId 
      );
      
      if (participantIndex === -1) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You are not an active participant in this bounty'
        });
      }
      
      const participant = bounty.participants[participantIndex];
      
      // Check if hunter has already used booster on this bounty
      if (participant.boosterActive) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You have already activated a Booster Pass for this bounty'
        });
      }
      
      // Check if hunter has already submitted work
      if (participant.submission && participant.submission.submittedAt) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Booster Pass cannot be used after submitting work'
        });
      }
      
      // Check if hunter has a booster pass to use (new system)
      const hunterPass = await HunterPass.findOne({
        hunter: hunterId,
        passType: 'booster'
      });
      
      const legacyHunter = await Hunter.findById(hunterId);
      
      // Check available passes in both systems
    //   const hasLegacyPass = legacyHunter && legacyHunter.passes.booster.count > 0;
      const hasNewPass = hunterPass && hunterPass.count > 0;
      
      if (!hasNewPass) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'You do not have any Booster Passes to use'
        });
      }
      
      // Get pass type to determine boost percentage
      const passType = await PassType.findOne({ name: 'booster' });
      const boostPercentage = passType?.boostPercentage || 25; // Default to 25% if not specified
      
      // Begin transaction
      session.startTransaction();
      
      // Update the hunter's participation record to activate booster
      await Bounty.updateOne(
        { 
          _id: bountyId,
          "participants.hunter": hunterId
        },
        { 
          $set: { "participants.$.boosterActive": true }
        },
        { session }
      );
      
      // Deduct pass from hunter's inventory (both systems)
      if (hasNewPass) {
        await HunterPass.updateOne(
          { _id: hunterPass._id },
          { 
            $inc: { count: -1 },
            $set: { lastUpdated: new Date() }
          },
          { session }
        );
      }
      
    //   if (hasLegacyPass) {
    //     await Hunter.findByIdAndUpdate(
    //       hunterId,
    //       { $inc: { 'passes.booster.count': -1 } },
    //       { session }
    //     );
    //   }
      
      // Record the pass usage
      await PassUsage.create([{
        hunter: hunterId,
        passType: 'booster',
        usedAt: new Date(),
        bounty: bountyId,
        effect: {
          boostPercentage: boostPercentage
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Create notification about the pass usage
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Booster Pass Activated',
        message: `You've activated a Booster Pass for "${bounty.title}". You will receive ${boostPercentage}% more XP when you complete this bounty.`,
        type: 'system',
        relatedItem: bountyId,
        itemModel: 'Bounty'
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Booster Pass activated successfully',
        data: {
          bounty: {
            id: bounty._id,
            title: bounty.title
          },
          booster: {
            activated: true,
            boostPercentage: boostPercentage,
            boostMultiplier: 1 + (boostPercentage / 100)
          },
          remainingPasses: (hasNewPass ? hunterPass.count : legacyHunter.passes.booster.count) - 1
        }
      });
    } catch (error) {
      // If an error occurs during the transaction, abort it
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error activating Booster Pass',
        error: error.message
      });
    } finally {
      // Always end the session
      session.endSession();
    }
  }
  
  // Route in hunterRoutes.js

  
 


  

  
};

module.exports = passController;