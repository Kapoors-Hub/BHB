// // controllers/issueController.js
// const Lord = require('../models/Lord');
// const Hunter = require('../models/Hunter');
// const Admin = require("../models/Admin")
// const upload = require('../config/multer');

// const issueController = {
//     // Report a new issue (works for both lords and hunters)
//     async reportIssue(req, res) {
//         try {
//             // Process the request after file upload is complete
//             upload.array('attachedFiles', 3)(req, res, async (err) => {
//                 if (err) {
//                     return res.status(400).json({
//                         status: 400,
//                         success: false,
//                         message: 'File upload error',
//                         error: err.message
//                     });
//                 }

//                 const { type, query } = req.body;
//                 const files = req.files || [];
                
//                 // Validate issue type
//                 const validTypes = ['Technical Issue ', 'Payment Issue',  'Project and Work Submission', 'Other', "Account & Profile", "Hunter/Lord Behavior", "General Inquiry"];

//                 if (!validTypes.includes(type)) {
//                     return res.status(400).json({
//                         status: 400,
//                         success: false,
//                         message: 'Invalid issue type'
//                     });
//                 }

//                 // Process uploaded files
//                 const attachedFiles = files.map(file => ({
//                     fileName: file.originalname,
//                     filePath: file.path,
//                     uploadedAt: new Date()
//                 }));

//                 // Determine user type and update accordingly
//                 let user, userType;
                
//                 if (req.lord) {
//                     user = await Lord.findById(req.lord.id);
//                     userType = 'lord';
//                 } else if (req.hunter) {
//                     user = await Hunter.findById(req.hunter.id);
//                     userType = 'hunter';
//                 } else {
//                     return res.status(401).json({
//                         status: 401,
//                         success: false,
//                         message: 'Unauthorized'
//                     });
//                 }

//                 // Add issue to user
//                 if (!user.issues) {
//                     user.issues = [];
//                 }
                
//                 user.issues.push({
//                     type,
//                     query,
//                     attachedFiles,
//                     status: 'open',
//                     createdAt: new Date()
//                 });

//                 await user.save();
                
//                 // Get the newly created issue
//                 const newIssue = user.issues[user.issues.length - 1];

//                 return res.status(201).json({
//                     status: 201,
//                     success: true,
//                     message: 'Issue reported successfully',
//                     data: {
//                         issueId: newIssue._id,
//                         type: newIssue.type,
//                         query: newIssue.query,
//                         status: newIssue.status,
//                         userType,
//                         filesUploaded: attachedFiles.length
//                     }
//                 });
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error reporting issue',
//                 error: error.message
//             });
//         }
//     },

//     // Get all issues for a user
//     async getMyIssues(req, res) {
//         try {
//             let user, userType;
            
//             if (req.lord) {
//                 user = await Lord.findById(req.lord.id).select('issues');
//                 userType = 'lord';
//             } else if (req.hunter) {
//                 user = await Hunter.findById(req.hunter.id).select('issues');
//                 userType = 'hunter';
//             } else {
//                 return res.status(401).json({
//                     status: 401,
//                     success: false,
//                     message: 'Unauthorized'
//                 });
//             }

//             // Ensure issues array exists
//             const issues = user.issues || [];
            
//             // Sort issues by createdAt (newest first)
//             const sortedIssues = issues.sort((a, b) => 
//                 b.createdAt - a.createdAt
//             );

//             return res.status(200).json({
//                 status: 200,
//                 success: true,
//                 message: 'Issues retrieved successfully',
//                 data: {
//                     userType,
//                     total: sortedIssues.length,
//                     open: sortedIssues.filter(i => i.status === 'open').length,
//                     inProgress: sortedIssues.filter(i => i.status === 'in-progress').length,
//                     resolved: sortedIssues.filter(i => i.status === 'resolved').length,
//                     closed: sortedIssues.filter(i => i.status === 'closed').length,
//                     issues: sortedIssues
//                 }
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error retrieving issues',
//                 error: error.message
//             });
//         }
//     },

//     // Get a specific issue
//     async getIssue(req, res) {
//         try {
//             const { issueId } = req.params;
//             let user, userType;
            
//             if (req.lord) {
//                 user = await Lord.findById(req.lord.id);
//                 userType = 'lord';
//             } else if (req.hunter) {
//                 user = await Hunter.findById(req.hunter.id);
//                 userType = 'hunter';
//             } else {
//                 return res.status(401).json({
//                     status: 401,
//                     success: false,
//                     message: 'Unauthorized'
//                 });
//             }
            
//             // Find the issue
//             const issue = user.issues?.id(issueId);

//             if (!issue) {
//                 return res.status(404).json({
//                     status: 404,
//                     success: false,
//                     message: 'Issue not found'
//                 });
//             }

//             return res.status(200).json({
//                 status: 200,
//                 success: true,
//                 message: 'Issue retrieved successfully',
//                 data: {
//                     ...issue.toObject(),
//                     userType
//                 }
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error retrieving issue',
//                 error: error.message
//             });
//         }
//     },

//     // Update an issue (users can only update open issues)
//     async updateIssue(req, res) {
//         try {
//             const { issueId } = req.params;
//             const { query, type } = req.body;
            
//             let user, userType;
            
//             if (req.lord) {
//                 user = await Lord.findById(req.lord.id);
//                 userType = 'lord';
//             } else if (req.hunter) {
//                 user = await Hunter.findById(req.hunter.id);
//                 userType = 'hunter';
//             } else {
//                 return res.status(401).json({
//                     status: 401,
//                     success: false,
//                     message: 'Unauthorized'
//                 });
//             }
            
//             const issue = user.issues?.id(issueId);

//             if (!issue) {
//                 return res.status(404).json({
//                     status: 404,
//                     success: false,
//                     message: 'Issue not found'
//                 });
//             }

//             // User can only update open issues
//             if (issue.status !== 'open') {
//                 return res.status(400).json({
//                     status: 400,
//                     success: false,
//                     message: 'Cannot update issue that is already in progress or resolved'
//                 });
//             }

//             // Update fields
//             if (query) issue.query = query;
//             if (type && ['technical', 'payment', 'content', 'other'].includes(type)) {
//                 issue.type = type;
//             }

//             await user.save();

//             return res.status(200).json({
//                 status: 200,
//                 success: true,
//                 message: 'Issue updated successfully',
//                 data: {
//                     ...issue.toObject(),
//                     userType
//                 }
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error updating issue',
//                 error: error.message
//             });
//         }
//     },

//     // Close an issue (user can close any of their issues)
//     async closeIssue(req, res) {
//         try {
//             const { issueId } = req.params;
            
//             let user, userType;
            
//             if (req.lord) {
//                 user = await Lord.findById(req.lord.id);
//                 userType = 'lord';
//             } else if (req.hunter) {
//                 user = await Hunter.findById(req.hunter.id);
//                 userType = 'hunter';
//             } else {
//                 return res.status(401).json({
//                     status: 401,
//                     success: false,
//                     message: 'Unauthorized'
//                 });
//             }
            
//             const issue = user.issues?.id(issueId);

//             if (!issue) {
//                 return res.status(404).json({
//                     status: 404,
//                     success: false,
//                     message: 'Issue not found'
//                 });
//             }

//             // Update status to closed
//             issue.status = 'closed';
//             await user.save();

//             return res.status(200).json({
//                 status: 200,
//                 success: true,
//                 message: 'Issue closed successfully',
//                 data: {
//                     ...issue.toObject(),
//                     userType
//                 }
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error closing issue',
//                 error: error.message
//             });
//         }
//     },

//     // responses
// async addResponseToIssue(req, res) {
//     try {
//         const { issueId } = req.params;
//         const { message } = req.body;
//         let senderRole, senderId, senderName;
        
//         // Determine sender information
//         if (req.lord) {
//             senderRole = 'Lord';
//             senderId = req.lord.id;
//             const lord = await Lord.findById(senderId);
//             senderName = `${lord.firstName} ${lord.lastName}`;
//         } else if (req.admin) {
//             senderRole = 'Admin';
//             senderId = req.admin.id;
//             const admin = await Admin.findById(senderId);
//             senderName = admin.username;
//         } else if (req.hunter) {
//             senderRole = 'Hunter';
//             senderId = req.hunter.id;
//             const hunter = await Hunter.findById(senderId);
//             senderName = hunter.name;
//         } else {
//             return res.status(401).json({
//                 status: 401, 
//                 success: false,
//                 message: 'Unauthorized'
//             });
//         }
        
//         // Upload files if provided (similar to your existing file upload logic)
//         const files = req.files || [];
//         const attachedFiles = files.map(file => ({
//             fileName: file.originalname,
//             filePath: file.path,
//             uploadedAt: new Date()
//         }));
        
//         // Find the appropriate user model and issue
//         let user, userType;
//         if (req.lord) {
//             user = await Lord.findById(req.lord.id);
//             userType = 'lord';
//         } else if (req.hunter) {
//             user = await Hunter.findById(req.hunter.id); 
//             userType = 'hunter';
//         } else if (req.admin) {
//             // Admin is responding to someone else's issue
//             const { userType: targetUserType, userId } = req.query;
            
//             if (targetUserType === 'lord') {
//                 user = await Lord.findById(userId);
//                 userType = 'lord';
//             } else if (targetUserType === 'hunter') {
//                 user = await Hunter.findById(userId);
//                 userType = 'hunter';
//             } else {
//                 return res.status(400).json({
//                     status: 400,
//                     success: false,
//                     message: 'Invalid user type'
//                 });
//             }
//         }
        
//         if (!user) {
//             return res.status(404).json({
//                 status: 404,
//                 success: false,
//                 message: 'User not found'
//             });
//         }
        
//         const issue = user.issues.id(issueId);
//         if (!issue) {
//             return res.status(404).json({
//                 status: 404,
//                 success: false,
//                 message: 'Issue not found'
//             });
//         }
        
//         // Add response to the issue
//         issue.responses.push({
//             message,
//             sender: {
//                 id: senderId,
//                 role: senderRole,
//                 name: senderName
//             },
//             attachedFiles,
//             createdAt: new Date()
//         });
        
//         await user.save();
        
//         return res.status(200).json({
//             status: 200,
//             success: true,
//             message: 'Response added to issue',
//             data: {
//                 issueId,
//                 userType,
//                 responseCount: issue.responses.length,
//                 latestResponse: issue.responses[issue.responses.length - 1]
//             }
//         });
//     } catch (error) {
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: 'Error adding response',
//             error: error.message
//         });
//     }
// }
// };

// module.exports = issueController;

// controllers/issueController.js
const Issue = require('../models/Issue');
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');
const Admin = require('../models/Admin');
const upload = require('../config/multer');

const issueController = {
  // Report a new issue (works for both lords and hunters)
  async reportIssue(req, res) {
    try {
      const { type, query } = req.body;
      const files = req.files || [];
      
      // Validate issue type
      const validTypes = ['Technical Issue ', 'Payment Issue', 'Project and Work Submission', 'Other', 'Account & Profile', 'Hunter/Lord Behavior', 'General Inquiry'];
  
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
  
      // Determine user type
      let userId, userName, userRole;
      
      if (req.lord) {
        userId = req.lord.id;
        userRole = 'Lord';
        const lord = await Lord.findById(userId);
        userName = `${lord.firstName} ${lord.lastName}`;
      } else if (req.hunter) {
        userId = req.hunter.id;
        userRole = 'Hunter';
        const hunter = await Hunter.findById(userId);
        userName = hunter.name;
      } else {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
  
      // Create new issue
      const newIssue = await Issue.create({
        user: {
          id: userId,
          role: userRole,
          name: userName
        },
        type,
        query,
        attachedFiles,
        status: 'open',
        createdAt: new Date()
      });
  
      // Add the issue reference to the user's document
      if (userRole === 'Hunter') {
        await Hunter.findByIdAndUpdate(
          userId,
          { $push: { issues: newIssue._id } }
        );
      } else if (userRole === 'Lord') {
        await Lord.findByIdAndUpdate(
          userId,
          { $push: { issues: newIssue._id } }
        );
      }
  
      return res.status(201).json({
        status: 201,
        success: true,
        message: 'Issue reported successfully',
        data: {
          issueId: newIssue._id,
          type: newIssue.type,
          query: newIssue.query,
          status: newIssue.status,
          userType: userRole.toLowerCase(),
          filesUploaded: attachedFiles.length
        }
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
      let userId, userRole;
      
      if (req.lord) {
        userId = req.lord.id;
        userRole = 'Lord';
      } else if (req.hunter) {
        userId = req.hunter.id;
        userRole = 'Hunter';
      } else {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }

      // Find all issues for this user
      const issues = await Issue.find({
        'user.id': userId,
        'user.role': userRole
      }).sort({ createdAt: -1 });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Issues retrieved successfully',
        data: {
          userType: userRole.toLowerCase(),
          total: issues.length,
          open: issues.filter(i => i.status === 'open').length,
          inProgress: issues.filter(i => i.status === 'in-progress').length,
          resolved: issues.filter(i => i.status === 'resolved').length,
          closed: issues.filter(i => i.status === 'closed').length,
          issues
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
      let userId, userRole;
      
      if (req.lord) {
        userId = req.lord.id;
        userRole = 'Lord';
      } else if (req.hunter) {
        userId = req.hunter.id;
        userRole = 'Hunter';
      } else if (req.admin) {
        // Admins can view any issue
        const issue = await Issue.findById(issueId);
        
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
          data: issue
        });
      } else {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
      
      // Users can only view their own issues
      const issue = await Issue.findOne({
        _id: issueId,
        'user.id': userId,
        'user.role': userRole
      });

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
          userType: userRole.toLowerCase()
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
      
      let userId, userRole;
      
      if (req.lord) {
        userId = req.lord.id;
        userRole = 'Lord';
      } else if (req.hunter) {
        userId = req.hunter.id;
        userRole = 'Hunter';
      } else {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const issue = await Issue.findOne({
        _id: issueId,
        'user.id': userId,
        'user.role': userRole
      });

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
      if (type && ['Technical Issue ', 'Payment Issue', 'Project and Work Submission', 'Other', 'Account & Profile', 'Hunter/Lord Behavior', 'General Inquiry'].includes(type)) {
        issue.type = type;
      }

      await issue.save();

      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Issue updated successfully',
        data: {
          ...issue.toObject(),
          userType: userRole.toLowerCase()
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
      
      let userId, userRole;
      
      if (req.lord) {
        userId = req.lord.id;
        userRole = 'Lord';
      } else if (req.hunter) {
        userId = req.hunter.id;
        userRole = 'Hunter';
      } else if (req.admin) {
        // Admins can close any issue
        const issue = await Issue.findById(issueId);
        
        if (!issue) {
          return res.status(404).json({
            status: 404,
            success: false,
            message: 'Issue not found'
          });
        }
        
        issue.status = 'closed';
        await issue.save();
        
        return res.status(200).json({
          status: 200,
          success: true,
          message: 'Issue closed successfully by admin',
          data: issue
        });
      } else {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const issue = await Issue.findOne({
        _id: issueId,
        'user.id': userId,
        'user.role': userRole
      });

      if (!issue) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Issue not found'
        });
      }

      // Update status to closed
      issue.status = 'closed';
      await issue.save();

      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Issue closed successfully',
        data: {
          ...issue.toObject(),
          userType: userRole.toLowerCase()
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

  // Add response to an issue
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
      
      // Upload files if provided
      const files = req.files || [];
      const attachedFiles = files.map(file => ({
        fileName: file.originalname,
        filePath: file.path,
        uploadedAt: new Date()
      }));
      
      // Find the issue
      let issue;
      
      if (req.admin) {
        // Admins can respond to any issue
        issue = await Issue.findById(issueId);
      } else {
        // Users can only respond to their own issues
        issue = await Issue.findOne({
          _id: issueId,
          'user.id': senderId,
          'user.role': senderRole
        });
      }
      
      if (!issue) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Issue not found'
        });
      }
      
      // Add response
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
      
      // If admin is responding, update status to in-progress if it's open
      if (senderRole === 'Admin' && issue.status === 'open') {
        issue.status = 'in-progress';
        issue.adminAssigned = senderId;
      }
      
      await issue.save();
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Response added to issue',
        data: {
          issueId,
          userType: issue.user.role.toLowerCase(),
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
  },
  
  // For admins to change issue status
  async updateIssueStatus(req, res) {
    try {
      if (!req.admin) {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { issueId } = req.params;
      const { status } = req.body;
      
      // Validate status
      if (!['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Invalid status'
        });
      }
      
      const issue = await Issue.findById(issueId);
      
      if (!issue) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Issue not found'
        });
      }
      
      // Update status
      issue.status = status;
      
      // If resolving, set resolvedAt date
      if (status === 'resolved') {
        issue.resolvedAt = new Date();
      }
      
      // Assign admin if moving to in-progress
      if (status === 'in-progress') {
        issue.adminAssigned = req.admin.id;
      }
      
      await issue.save();
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Issue status updated successfully',
        data: issue
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error updating issue status',
        error: error.message
      });
    }
  },
  
  // For admins to get all issues
  async getAllIssues(req, res) {
    try {
      if (!req.admin) {
        return res.status(401).json({
          status: 401,
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { status, userType, page = 1, limit = 10 } = req.query;
      
      // Build query
      const query = {};
      if (status) query.status = status;
      if (userType) query['user.role'] = userType === 'hunter' ? 'Hunter' : 'Lord';
      
      // Pagination
      const skip = (page - 1) * limit;
      
      // Get issues
      const issues = await Issue.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      const total = await Issue.countDocuments(query);
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Issues retrieved successfully',
        data: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          issues
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
  }
};

module.exports = issueController;