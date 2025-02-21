// controllers/hunterBountyController.js
const Bounty = require('../models/Bounty');
const Hunter = require('../models/Hunter');
const path = require('path');

const hunterBountyController = {
    // Get all available bounties
    async getAvailableBounties(req, res) {
        try {
            const currentDate = new Date();
            
            // Remove filters temporarily to see all bounties
            const bounties = await Bounty.find({})
                .populate('createdBy', 'username');

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Available bounties fetched successfully',
                data: bounties
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounties',
                error: error.message
            });
        }
    },
    // Get single bounty details
    async getBountyDetails(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId)
                .populate('createdBy', 'username')
                .populate('participants.hunter', 'username');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty details fetched successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounty details',
                error: error.message
            });
        }
    },

    // Accept a bounty
    async acceptBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);
            const hunterId = req.hunter.id;
    
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
    
            // Check if bounty is still accepting hunters
            if (bounty.currentHunters >= bounty.maxHunters) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Bounty has reached maximum participants'
                });
            }
    
            // Check if hunter already participating
            const isParticipating = bounty.participants.some(
                p => p.hunter.toString() === hunterId
            );
    
            if (isParticipating) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'You are already participating in this bounty'
                });
            }
    
            // Add hunter to participants array and increment currentHunters
            await Bounty.findByIdAndUpdate(
                bounty._id,
                {
                    $push: { 
                        participants: {
                            hunter: hunterId,
                            joinedAt: new Date(),
                            status: 'active'
                        }
                    },
                    $inc: { currentHunters: 1 }
                },
                { new: true }
            );
    
            // Add bounty to hunter's accepted bounties
            await Hunter.findByIdAndUpdate(
                hunterId,
                { $push: { acceptedBounties: bounty._id } }
            );
    
            const updatedBounty = await Bounty.findById(bounty._id)
                .populate('participants.hunter', 'username');
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty accepted successfully',
                data: updatedBounty
            });
    
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error accepting bounty',
                error: error.message
            });
        }
    },
    
    // Get my accepted bounties
    async getMyBounties(req, res) {
        try {
            const hunterId = req.hunter.id;

            const participatingBounties = await Bounty.find({
                'participants.hunter': hunterId
            }).populate('createdBy', 'username');

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Your bounties fetched successfully',
                data: participatingBounties
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching your bounties',
                error: error.message
            });
        }
    },

    // Submit Bounty
    async submitBountyWork(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            const { description } = req.body;
            const files = req.files; // Multer adds files to req
    
            // Find the bounty
            const bounty = await Bounty.findById(bountyId);
            
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
    
            // Check if hunter is a participant
            const isParticipant = bounty.participants.some(
                p => p.hunter.toString() === hunterId && p.status === 'active'
            );
    
            if (!isParticipant) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'You are not a participant of this bounty'
                });
            }
    
            // Check if bounty is still active
            if (bounty.status !== 'active') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Bounty is not active for submissions'
                });
            }
    
            // Check if submission is within time limit
            const currentTime = new Date();
            if (currentTime > bounty.endTime) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Submission deadline has passed'
                });
            }
    
            // Process uploaded files
            const fileDetails = files.map(file => ({
                fileName: file.originalname,
                filePath: file.path,
                uploadedAt: new Date()
            }));
    
            // Update participant's submission
            await Bounty.findOneAndUpdate(
                { 
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.submission': {
                            description,
                            files: fileDetails,
                            submittedAt: new Date()
                        },
                        'participants.$.status': 'completed'
                    }
                }
            );
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Work submitted successfully',
                data: {
                    submissionTime: new Date(),
                    bountyTitle: bounty.title,
                    filesUploaded: fileDetails.map(f => f.fileName)
                }
            });
    
        } catch (error) {
            console.error('Submission error:', error);
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error submitting work',
                error: error.message
            });
        }
    }
};

module.exports = hunterBountyController;