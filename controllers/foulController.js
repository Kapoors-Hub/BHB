// controllers/foulController.js
const Foul = require('../models/Foul');
const FoulRecord = require('../models/FoulRecord');
const Hunter = require('../models/Hunter');

const foulController = {
    // Create a new foul type
    async createFoul(req, res) {
        try {
            const { name, description, severity,needsOccurrenceTracking } = req.body;
            const adminId = req.admin.id;

            // Validate severity
            if (!['low', 'medium', 'high'].includes(severity)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid severity level. Must be low, medium, or high.'
                });
            }

            // Determine XP penalty percentage based on severity
            let xpPenaltyPercentage;
            switch (severity) {
                case 'low':
                    xpPenaltyPercentage = 5;  // 5% of 2500 = 125 XP
                    break;
                case 'medium':
                    xpPenaltyPercentage = 15; // 15% of 2500 = 375 XP
                    break;
                case 'high':
                    xpPenaltyPercentage = 25; // 25% of 2500 = 625 XP
                    break;
            }

            // Create the foul
            const foul = await Foul.create({
                name,
                description,
                severity,
                needsOccurrenceTracking,
                xpPenaltyPercentage,
                createdBy: adminId
            });

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Foul created successfully',
                data: {
                    foul,
                    xpPenalty: (xpPenaltyPercentage / 100) * 2500
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating foul',
                error: error.message
            });
        }
    },

    // Get all fouls
    async getAllFouls(req, res) {
        try {
            const fouls = await Foul.find().sort({ severity: -1, createdAt: -1 });

            // Calculate actual XP penalty amounts
            const foulsWithPenalties = fouls.map(foul => ({
                ...foul.toObject(),
                xpPenaltyAmount: (foul.xpPenaltyPercentage / 100) * 2500
            }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Fouls retrieved successfully',
                data: {
                    count: fouls.length,
                    fouls: foulsWithPenalties
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving fouls',
                error: error.message
            });
        }
    },

    // Update a foul
    async updateFoul(req, res) {
        try {
            const { foulId } = req.params;
            const { name, description, active } = req.body;

            // Find the foul
            const foul = await Foul.findById(foulId);
            if (!foul) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Foul not found'
                });
            }

            // Update basic properties only (not severity or penalty)
            const updatedFoul = await Foul.findByIdAndUpdate(
                foulId,
                { name, description, active },
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Foul updated successfully',
                data: {
                    foul: updatedFoul,
                    xpPenaltyAmount: (updatedFoul.xpPenaltyPercentage / 100) * 2500
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating foul',
                error: error.message
            });
        }
    },

    // Apply a foul to a hunter
    async applyFoul(req, res) {
      try {
          const { hunterId, foulId, reason, evidence, relatedBountyId } = req.body;
          const adminId = req.admin.id;
  
          // Find the hunter
          const hunter = await Hunter.findById(hunterId);
          if (!hunter) {
              return res.status(404).json({
                  status: 404,
                  success: false,
                  message: 'Hunter not found'
              });
          }
  
          // Find the foul
          const foul = await Foul.findById(foulId);
          if (!foul) {
              return res.status(404).json({
                  status: 404,
                  success: false,
                  message: 'Foul not found'
              });
          }
  
          if (!foul.active) {
              return res.status(400).json({
                  status: 400,
                  success: false,
                  message: 'This foul type is no longer active'
              });
          }
  
          // Calculate XP penalty
          let xpPenalty = Math.round((foul.xpPenaltyPercentage / 100) * 2500);
  
          // If this is a "Hunter Quits Bounty (Before LIVE)" foul, ensure penalty is 0
          if (foul.name === "Hunter Quits Bounty (Before LIVE)") {
              xpPenalty = 0; // No penalty before live
          }
  
          // Check if occurrence tracking is needed for strikes
          let isStrike = false;
          let occurrenceNumber = 1;
          let newStrikeCount = hunter.strikes?.count || 0;
  
          if (foul.needsOccurrenceTracking) {
              // Find previous occurrences of this foul for this hunter
              const previousOccurrences = await FoulRecord.find({
                  hunter: hunterId,
                  foul: foulId
              }).sort({ appliedAt: 1 });
  
              occurrenceNumber = previousOccurrences.length + 1;
  
              // Apply strike starting from second occurrence
              if (occurrenceNumber > 1) {
                  isStrike = true;
                  newStrikeCount++;
              }
          }
  
          // Create foul record
          const foulRecord = await FoulRecord.create({
              hunter: hunterId,
              foul: foulId,
              reason,
              evidence,
              xpPenalty,
              occurrenceNumber,
              isStrike,
              appliedBy: adminId,
              relatedBounty: relatedBountyId
          });
  
          // Check if this foul pushes hunter to 3 strikes (suspension threshold)
          let suspensionApplied = false;
          if (isStrike && newStrikeCount >= 3) {
              // Calculate suspension period (14 days from now)
              const suspensionStartDate = new Date();
              const suspensionEndDate = new Date();
              suspensionEndDate.setDate(suspensionEndDate.getDate() + 14);
              
              // Update hunter with suspension
              await Hunter.findByIdAndUpdate(
                  hunterId,
                  {
                      $set: {
                          'strikes.isCurrentlySuspended': true,
                          'strikes.suspensionEndDate': suspensionEndDate
                      },
                      $push: {
                          'strikes.suspensionHistory': {
                              startDate: suspensionStartDate,
                              endDate: suspensionEndDate,
                              reason: `Accumulated 3 strikes. Latest foul: ${foul.name}`
                          }
                      },
                      $inc: { xp: -xpPenalty }
                  }
              );
              
              suspensionApplied = true;
              
              // Create notification for suspension
              await notificationController.createNotification({
                  hunterId: hunterId,
                  title: 'Account Suspended',
                  message: `Your account has been suspended for 14 days due to accumulating 3 strikes. You will be able to return on ${suspensionEndDate.toLocaleDateString()}.`,
                  type: 'system'
              });
          } else {
              // Just update XP and strike count
              await Hunter.findByIdAndUpdate(
                  hunterId,
                  {
                      $inc: { xp: -xpPenalty, 'strikes.count': isStrike ? 1 : 0 }
                  }
              );
              
              // Create notification for foul
              await notificationController.createNotification({
                  hunterId: hunterId,
                  title: 'Foul Received',
                  message: `You have received a foul: "${foul.name}". This has resulted in a penalty of ${xpPenalty} XP.${isStrike ? ' This foul counts as a strike.' : ''}`,
                  type: 'system'
              });
          }
  
          // Fetch updated hunter data
          const updatedHunter = await Hunter.findById(hunterId);
  
          return res.status(201).json({
              status: 201,
              success: true,
              message: 'Foul applied successfully',
              data: {
                  foulRecord,
                  hunterName: hunter.name,
                  foulName: foul.name,
                  severity: foul.severity,
                  xpPenalty,
                  isStrike,
                  occurrenceNumber,
                  newXpTotal: updatedHunter.xp,
                  strikeCount: updatedHunter.strikes?.count || 0,
                  suspensionApplied,
                  suspensionEndDate: suspensionApplied ? updatedHunter.strikes.suspensionEndDate : null
              }
          });
      } catch (error) {
          return res.status(500).json({
              status: 500,
              success: false,
              message: 'Error applying foul',
              error: error.message
          });
      }
  },

    // Get foul history for a hunter
    async getHunterFoulHistory(req, res) {
        try {
            const { hunterId } = req.params;

            // Check if hunter exists
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }

            // Get foul records
            const foulRecords = await FoulRecord.find({ hunter: hunterId })
                .populate('foul', 'name description severity')
                .populate('appliedBy', 'username')
                .populate('relatedBounty', 'title')
                .sort({ appliedAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter foul history retrieved successfully',
                data: {
                    hunterName: hunter.name,
                    totalFouls: foulRecords.length,
                    totalXpPenalty: foulRecords.reduce((sum, record) => sum + record.xpPenalty, 0),
                    foulRecords
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving foul history',
                error: error.message
            });
        }
    },

    // Remove foul from hunter
async removeFoulFromHunter(req, res) {
    try {
      const { hunterId, foulRecordId } = req.params;
      const { reason } = req.body;
      const adminId = req.admin.id;
  
      // Check if hunter exists
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Check if foul record exists
      const foulRecord = await FoulRecord.findOne({
        _id: foulRecordId,
        hunter: hunterId
      }).populate('foul', 'name xpPenaltyPercentage');
  
      if (!foulRecord) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Foul record not found'
        });
      }
  
      // Restore XP penalty
      await Hunter.findByIdAndUpdate(hunterId, {
        $inc: { xp: foulRecord.xpPenalty }
      });
  
      // Mark foul as removed
      foulRecord.removed = true;
      foulRecord.removedAt = new Date();
      foulRecord.removedBy = adminId;
      foulRecord.removalReason = reason || 'Administrative decision';
      
      await foulRecord.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Foul Removed',
        message: `Your "${foulRecord.foul.name}" foul has been removed${reason ? ` for: ${reason}` : ''}. ${foulRecord.xpPenalty} XP has been restored.`,
        type: 'system'
      });
  
      // Log the action
      console.log(`Admin ${adminId} removed foul ${foulRecordId} from hunter ${hunterId}`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Foul removed successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          foul: {
            id: foulRecord.foul._id,
            name: foulRecord.foul.name
          },
          xpRestored: foulRecord.xpPenalty
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error removing foul',
        error: error.message
      });
    }
  },
  
  // Reduce foul penalty
  async reduceFoulPenalty(req, res) {
    try {
      const { hunterId, foulRecordId } = req.params;
      const { reductionPercentage, reason } = req.body;
      const adminId = req.admin.id;
  
      if (!reductionPercentage || isNaN(reductionPercentage) || reductionPercentage <= 0 || reductionPercentage > 100) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Valid reduction percentage (1-100) is required'
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
  
      // Check if foul record exists
      const foulRecord = await FoulRecord.findOne({
        _id: foulRecordId,
        hunter: hunterId
      }).populate('foul', 'name xpPenaltyPercentage');
  
      if (!foulRecord) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Foul record not found'
        });
      }
  
      // Calculate XP to restore
      const xpToRestore = Math.ceil(foulRecord.xpPenalty * (reductionPercentage / 100));
      
      // Update hunter XP
      await Hunter.findByIdAndUpdate(hunterId, {
        $inc: { xp: xpToRestore }
      });
  
      // Update foul record
      foulRecord.reducedPenalty = true;
      foulRecord.reducedAt = new Date();
      foulRecord.reducedBy = adminId;
      foulRecord.reductionPercentage = reductionPercentage;
      foulRecord.reductionReason = reason || 'Administrative decision';
      foulRecord.xpRestored = xpToRestore;
      
      await foulRecord.save();
  
      // Create notification for hunter
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Foul Penalty Reduced',
        message: `The penalty for your "${foulRecord.foul.name}" foul has been reduced by ${reductionPercentage}%. ${xpToRestore} XP has been restored.`,
        type: 'system'
      });
  
      // Log the action
      console.log(`Admin ${adminId} reduced foul ${foulRecordId} penalty for hunter ${hunterId} by ${reductionPercentage}%`);
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Foul penalty reduced successfully',
        data: {
          hunter: {
            id: hunter._id,
            name: hunter.name,
            username: hunter.username
          },
          foul: {
            id: foulRecord.foul._id,
            name: foulRecord.foul.name
          },
          reductionPercentage,
          xpRestored: xpToRestore
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error reducing foul penalty',
        error: error.message
      });
    }
  }
};

module.exports = foulController;