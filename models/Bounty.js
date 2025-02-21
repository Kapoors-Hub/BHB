// models/Bounty.js
const mongoose = require('mongoose');

const bountySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    context: {
        type: String,
        required: [true, 'Context is required']
    },
    deliverables: {
        type: String,
        required: [true, 'Deliverables is required']
    },
    challenge: {
        type: String,
        required: [true, 'Challenge is required']
    },
    startTime: {
        type: Date,
        required: [true, 'Start time is required']
    },
    endTime: {
        type: Date,
        required: [true, 'End time is required']
    },
    resultTime: {
        type: Date,
        required: [true, 'Result time is required']
    },
    assets: [{
        fileName: String,
        fileUrl: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    doubtSessionTime: {
        type: String,  // Format: "HH:mm"
        required: [true, 'Doubt session time is required']
    },
    doubtSessionDate: {
        type: Date,
        required: [true, 'Doubt session date is required']
    },
    doubtSessionLink: {
        type: String,
        required: [true, 'Doubt session link is required']
    },
    rewardPrize: {
        type: Number,
        required: [true, 'Reward prize is required'],
        min: [0, 'Reward prize cannot be negative']
    },
    maxHunters: {
        type: Number,
        required: [true, 'Number of hunters allowed is required'],
        min: [1, 'At least one hunter must be allowed']
    },
    paid: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lord',
        required: true
    },
    currentHunters: {
        type: Number,
        default: 0
    },
    participants: [{
        hunter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hunter'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['active', 'completed', 'withdrawn'],
            default: 'active'
        },
        submission: {
            description: String,
            files: [{
                fileName: String,
                filePath: String,
                uploadedAt: Date
            }],
            submittedAt: Date
        }
    }],
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Bounty', bountySchema);