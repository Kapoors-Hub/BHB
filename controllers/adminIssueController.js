// controllers/adminIssueController.js
const Admin = require('../models/Admin');
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');

const adminIssueController = {
    // Get all open issues across users
    async getAllIssues(req, res) {
        try {
            // Get lord issues
            const lords = await Lord.find().select('issues username email firstName lastName');
            const lordIssues = lords.flatMap(lord => 
                lord.issues.map(issue => ({
                    ...issue.toObject(),
                    userType: 'lord',
                    userId: lord._id,
                    username: lord.username,
                    email: lord.email,
                    name: `${lord.firstName} ${lord.lastName}`
                }))
            );

            // Get hunter issues
            const hunters = await Hunter.find().select('issues username name collegeEmail');
            const hunterIssues = hunters.flatMap(hunter => 
                hunter.issues.map(issue => ({
                    ...issue.toObject(),
                    userType: 'hunter',
                    userId: hunter._id,
                    username: hunter.username,
                    email: hunter.collegeEmail,
                    name: hunter.name
                }))
            );

            // Combine and sort by creation date (newest first)
            const allIssues = [...lordIssues, ...hunterIssues]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Group by status
            const issuesByStatus = {
                open: allIssues.filter(issue => issue.status === 'open'),
                inProgress: allIssues.filter(issue => issue.status === 'in-progress'),
                resolved: allIssues.filter(issue => issue.status === 'resolved'),
                closed: allIssues.filter(issue => issue.status === 'closed')
            };

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'All issues retrieved successfully',
                data: {
                    total: allIssues.length,
                    counts: {
                        open: issuesByStatus.open.length,
                        inProgress: issuesByStatus.inProgress.length,
                        resolved: issuesByStatus.resolved.length,
                        closed: issuesByStatus.closed.length
                    },
                    issuesByStatus
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

    // Get issues by type
    async getIssuesByType(req, res) {
        try {
            const { type } = req.params;
            
            if (!['technical', 'payment', 'content', 'other'].includes(type)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid issue type'
                });
            }

            // Get filtered issues
            const lords = await Lord.find().select('issues username email firstName lastName');
            const lordIssues = lords.flatMap(lord => 
                lord.issues
                    .filter(issue => issue.type === type)
                    .map(issue => ({
                        ...issue.toObject(),
                        userType: 'lord',
                        userId: lord._id,
                        username: lord.username,
                        email: lord.email,
                        name: `${lord.firstName} ${lord.lastName}`
                    }))
            );

            const hunters = await Hunter.find().select('issues username name collegeEmail');
            const hunterIssues = hunters.flatMap(hunter => 
                hunter.issues
                    .filter(issue => issue.type === type)
                    .map(issue => ({
                        ...issue.toObject(),
                        userType: 'hunter',
                        userId: hunter._id,
                        username: hunter.username,
                        email: hunter.collegeEmail,
                        name: hunter.name
                    }))
            );

            // Combine and sort
            const allIssues = [...lordIssues, ...hunterIssues]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return res.status(200).json({
                status: 200,
                success: true,
                message: `Issues of type '${type}' retrieved successfully`,
                data: {
                    total: allIssues.length,
                    issues: allIssues
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving issues by type',
                error: error.message
            });
        }
    },

    // Assign issue to admin (change status to in-progress)
    async assignIssue(req, res) {
        try {
            const { userType, userId, issueId } = req.params;
            const adminId = req.admin.id;

            if (!['lord', 'hunter'].includes(userType)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid user type'
                });
            }

            // Find the user and update issue
            let user;
            if (userType === 'lord') {
                user = await Lord.findById(userId);
            } else {
                user = await Hunter.findById(userId);
            }

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'User not found'
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

            // Update issue status and admin ID
            issue.status = 'in-progress';
            issue.adminId = adminId;
            await user.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue assigned successfully',
                data: {
                    issue: issue.toObject(),
                    userType,
                    userId
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error assigning issue',
                error: error.message
            });
        }
    },

    // Resolve issue
    async resolveIssue(req, res) {
        try {
            const { userType, userId, issueId } = req.params;
            const { response } = req.body;
            const adminId = req.admin.id;

            if (!response) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Response is required'
                });
            }

            if (!['lord', 'hunter'].includes(userType)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid user type'
                });
            }

            // Find the user and update issue
            let user;
            if (userType === 'lord') {
                user = await Lord.findById(userId);
            } else {
                user = await Hunter.findById(userId);
            }

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'User not found'
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

            // Update issue
            issue.status = 'resolved';
            issue.adminResponse = response;
            issue.adminId = adminId;
            issue.resolvedAt = new Date();
            await user.save();

            // Optionally send notification email (implementation not shown)

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue resolved successfully',
                data: {
                    issue: issue.toObject(),
                    userType,
                    userId
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error resolving issue',
                error: error.message
            });
        }
    },

    // Get issue details
    async getIssueDetails(req, res) {
        try {
            const { userType, userId, issueId } = req.params;

            if (!['lord', 'hunter'].includes(userType)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid user type'
                });
            }

            // Find the user and get issue
            let user, userData;
            if (userType === 'lord') {
                user = await Lord.findById(userId);
                if (user) {
                    userData = {
                        username: user.username,
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`,
                        mobileNumber: user.mobileNumber
                    };
                }
            } else {
                user = await Hunter.findById(userId);
                if (user) {
                    userData = {
                        username: user.username,
                        email: user.collegeEmail,
                        name: user.name,
                        mobileNumber: user.mobileNumber
                    };
                }
            }

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'User not found'
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

            // Get admin details if assigned
            let adminData = null;
            if (issue.adminId) {
                const admin = await Admin.findById(issue.adminId);
                if (admin) {
                    adminData = {
                        username: admin.username,
                        email: admin.email
                    };
                }
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Issue details retrieved successfully',
                data: {
                    issue: issue.toObject(),
                    user: userData,
                    admin: adminData
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving issue details',
                error: error.message
            });
        }
    }
};

module.exports = adminIssueController;