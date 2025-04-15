// models/FoulRecord.js
const mongoose = require('mongoose');

const foulRecordSchema = new mongoose.Schema({
    hunter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter',
        required: true
    },
    foul: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Foul',
        required: true
    },
    reason: {
        type: String,
        required: [true, 'Reason for applying foul is required']
    },
    evidence: String,
    xpPenalty: {
        type: Number,
        required: true
    },
    occurrenceNumber: {
        type: Number,
        default: 1
    },
    isStrike: {
        type: Boolean,
        default: false
    },
    appliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false
    },
    appliedAt: {
        type: Date,
        default: Date.now
    },
    relatedBounty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bounty'
    },
    // New fields for tracking cleared status
    isCleared: {
        type: Boolean,
        default: false
    },
    clearedAt: {
        type: Date
    },
    clearedBy: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'clearedBy.role'
        },
        role: {
            type: String,
            enum: ['Admin', 'Hunter']
        }
    }
});

module.exports = mongoose.model('FoulRecord', foulRecordSchema);