// models/Foul.js
const mongoose = require('mongoose');

const foulSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Foul name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Foul description is required']
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: [true, 'Severity level is required']
    },
    xpPenaltyPercentage: {
        type: Number,
        required: [true, 'XP penalty percentage is required']
    },
    needsOccurrenceTracking: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Foul', foulSchema);