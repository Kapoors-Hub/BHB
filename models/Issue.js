// models/Issue.js
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  sender: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'sender.role'
    },
    role: {
      type: String,
      enum: ['Admin', 'Lord', 'Hunter'],
      required: true
    },
    name: String
  },
  attachedFiles: [{
    fileName: String,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const issueSchema = new mongoose.Schema({
  user: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'user.role',
      required: true
    },
    role: {
      type: String,
      enum: ['Hunter', 'Lord'],
      required: true
    },
    name: String
  },
  type: {
    type: String,
    required: [true, 'Issue type is required'],
    enum: ['Technical Issue ', 'Payment Issue', 'Project and Work Submission', 'Other', 'Account & Profile', 'Hunter/Lord Behavior', 'General Inquiry']
  },
  query: {
    type: String,
    required: [true, 'Query description is required']
  },
  attachedFiles: [{
    fileName: String,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  responses: [responseSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  adminAssigned: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
});

// Indexes for faster querying
issueSchema.index({ 'user.id': 1, 'user.role': 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);