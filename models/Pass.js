// models/Pass.js
const mongoose = require('mongoose');

const passSchema = new mongoose.Schema({
    hunter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter',
        required: true
    },
    passType: {
        type: String,
        enum: ['timeExtension', 'resetFoul', 'booster', 'seasonal'],
        required: true
    },
    usedAt: {
        type: Date,
        default: Date.now
    },
    relatedBounty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bounty'
    },
    relatedFoul: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoulRecord'
    },
    xpBoosted: Number,  // For booster pass
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'expired'],
        default: 'active'
    },
    effectUntil: Date  // For passes with time limits
});

module.exports = mongoose.model('Pass', passSchema);