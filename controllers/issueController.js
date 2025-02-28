// controllers/issueController.js
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');
const upload = require('../config/multer');

const issueController = {
    // Report a new issue (works for both lords and hunters)
    async reportIssue(req, res) {
        try {
            // Process the request after file upload is complete
            upload.array('attachedFiles', 3)(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'File upload error',
                        error: err.message
                    });
                }

                const { type, query } = req.body;
                const files = req.files || [];
                
                // Validate issue type
                const validTypes = ['technical', 'payment', 'content', 'other'];
                if (!validTypes.includes(type)) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Invalid issue type'
                    });
                }

                // Process uploaded files
                const attachedFiles = files.map(file => ({
                    fileName: file.originalname,
                    filePath: file.path,
                    uploadedAt: new Date()
                }));

                // Determine user type and update accordingly
                let user, userType;
                
                if (req.lord) {
                    user = await Lord.findById(req.lord.id);
                    userType = 'lord';
                } else if (req.hunter) {
                    user = await Hunter.findById(req.hunter.id);
                    userType = 'hunter';
                } else {
                    return res.status(401).json({
                        status: 401,
                        success: false,
                        message: 'Unauthorized'
                    });
                }

                // Add issue to user
                if (!user.issues) {
                    user.issues = [];
                }
                
                user.issues.push({
                    type,
                    query,
                    attachedFiles,
                    status: 'open',
                    createdAt: new Date()
                });

                await user.save();
                
                // Get the newly created issue
                const newIssue = user.issues[user.issues.length - 1];

                return res.status(201).json({
                    status: 201,
                    success: true,
                    message: 'Issue reported successfully',
                    data: {
                        issueId: newIssue._id,
                        type: newIssue.type,
                        query: newIssue.query,
                        status: newIssue.status,
                        userType,
                        filesUploaded: attachedFiles.length
                    }
                });
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error reporting issue',
                error: error.message
            });
        }
    },

    // Get all issues for a user
    async getMyIssues(req, res) {
        try {
            let user, userType;
            
            if (req.lord) {
                user = await Lord.findById(req.lord.id).select('issues');
                userType = 'lord';
            } else if (req.hunter) {
                user = await Hunter.findById(req.hunter.id).select('issues');
                userType = 'hunter';
            } else {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Unauthorized'
                });
            }

            // Ensure issues array exists
            const issues = user.issues || [];
            
            // Sort issues by createdAt (newest first)
            const sortedIssues = issues.sort((a, b) => 
                b.createdAt - a.createdAt
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issues retrieved successfully',
                data: {
                    userType,
                    total: sortedIssues.length,
                    open: sortedIssues.filter(i => i.status === 'open').length,
                    inProgress: sortedIssues.filter(i => i.status === 'in-progress').length,
                    resolved: sortedIssues.filter(i => i.status === 'resolved').length,
                    closed: sortedIssues.filter(i => i.status === 'closed').length,
                    issues: sortedIssues
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving issues',
                error: error.message
            });
        }
    },

    // Get a specific issue
    async getIssue(req, res) {
        try {
            const { issueId } = req.params;
            let user, userType;
            
            if (req.lord) {
                user = await Lord.findById(req.lord.id);
                userType = 'lord';
            } else if (req.hunter) {
                user = await Hunter.findById(req.hunter.id);
                userType = 'hunter';
            } else {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Unauthorized'
                });
            }
            
            // Find the issue
            const issue = user.issues?.id(issueId);

            if (!issue) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Issue not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue retrieved successfully',
                data: {
                    ...issue.toObject(),
                    userType
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving issue',
                error: error.message
            });
        }
    },

    // Update an issue (users can only update open issues)
    async updateIssue(req, res) {
        try {
            const { issueId } = req.params;
            const { query, type } = req.body;
            
            let user, userType;
            
            if (req.lord) {
                user = await Lord.findById(req.lord.id);
                userType = 'lord';
            } else if (req.hunter) {
                user = await Hunter.findById(req.hunter.id);
                userType = 'hunter';
            } else {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Unauthorized'
                });
            }
            
            const issue = user.issues?.id(issueId);

            if (!issue) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Issue not found'
                });
            }

            // User can only update open issues
            if (issue.status !== 'open') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot update issue that is already in progress or resolved'
                });
            }

            // Update fields
            if (query) issue.query = query;
            if (type && ['technical', 'payment', 'content', 'other'].includes(type)) {
                issue.type = type;
            }

            await user.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue updated successfully',
                data: {
                    ...issue.toObject(),
                    userType
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating issue',
                error: error.message
            });
        }
    },

    // Close an issue (user can close any of their issues)
    async closeIssue(req, res) {
        try {
            const { issueId } = req.params;
            
            let user, userType;
            
            if (req.lord) {
                user = await Lord.findById(req.lord.id);
                userType = 'lord';
            } else if (req.hunter) {
                user = await Hunter.findById(req.hunter.id);
                userType = 'hunter';
            } else {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Unauthorized'
                });
            }
            
            const issue = user.issues?.id(issueId);

            if (!issue) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Issue not found'
                });
            }

            // Update status to closed
            issue.status = 'closed';
            await user.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue closed successfully',
                data: {
                    ...issue.toObject(),
                    userType
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error closing issue',
                error: error.message
            });
        }
    },

    // responses
async addResponseToIssue(req, res) {
    try {
        const { issueId } = req.params;
        const { message } = req.body;
        let senderRole, senderId, senderName;
        
        // Determine sender information
        if (req.lord) {
            senderRole = 'Lord';
            senderId = req.lord.id;
            const lord = await Lord.findById(senderId);
            senderName = `${lord.firstName} ${lord.lastName}`;
        } else if (req.admin) {
            senderRole = 'Admin';
            senderId = req.admin.id;
            const admin = await Admin.findById(senderId);
            senderName = admin.username;
        } else if (req.hunter) {
            senderRole = 'Hunter';
            senderId = req.hunter.id;
            const hunter = await Hunter.findById(senderId);
            senderName = hunter.name;
        } else {
            return res.status(401).json({
                status: 401, 
                success: false,
                message: 'Unauthorized'
            });
        }
        
        // Upload files if provided (similar to your existing file upload logic)
        const files = req.files || [];
        const attachedFiles = files.map(file => ({
            fileName: file.originalname,
            filePath: file.path,
            uploadedAt: new Date()
        }));
        
        // Find the appropriate user model and issue
        let user, userType;
        if (req.lord) {
            user = await Lord.findById(req.lord.id);
            userType = 'lord';
        } else if (req.hunter) {
            user = await Hunter.findById(req.hunter.id); 
            userType = 'hunter';
        } else if (req.admin) {
            // Admin is responding to someone else's issue
            const { userType: targetUserType, userId } = req.query;
            
            if (targetUserType === 'lord') {
                user = await Lord.findById(userId);
                userType = 'lord';
            } else if (targetUserType === 'hunter') {
                user = await Hunter.findById(userId);
                userType = 'hunter';
            } else {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid user type'
                });
            }
        }
        
        if (!user) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }
        
        const issue = user.issues.id(issueId);
        if (!issue) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Issue not found'
            });
        }
        
        // Add response to the issue
        issue.responses.push({
            message,
            sender: {
                id: senderId,
                role: senderRole,
                name: senderName
            },
            attachedFiles,
            createdAt: new Date()
        });
        
        await user.save();
        
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Response added to issue',
            data: {
                issueId,
                userType,
                responseCount: issue.responses.length,
                latestResponse: issue.responses[issue.responses.length - 1]
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error adding response',
            error: error.message
        });
    }
}
};

module.exports = issueController;