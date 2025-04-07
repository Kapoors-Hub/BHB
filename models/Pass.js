// // models/Pass.js
// const mongoose = require('mongoose');

// const passSchema = new mongoose.Schema({
//     hunter: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Hunter',
//         required: true
//     },
//     passType: {
//         type: String,
//         enum: ['timeExtension', 'resetFoul', 'booster', 'seasonal'],
//         required: true
//     },
//     usedAt: {
//         type: Date,
//         default: Date.now
//     },
//     relatedBounty: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Bounty'
//     },
//     relatedFoul: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'FoulRecord'
//     },
//     xpBoosted: Number,  // For booster pass
//     status: {
//         type: String,
//         enum: ['pending', 'active', 'completed', 'expired'],
//         default: 'active'
//     },
//     effectUntil: Date  // For passes with time limits
// });

// module.exports = mongoose.model('Pass', passSchema);

// First, let's update the Pass model to better suit this need
// models/Pass.js
const mongoose = require('mongoose');

const passSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Pass name is required'],
        unique: true,
        trim: true
    },
    passType: {
        type: String,
        enum: ['timeExtension', 'resetFoul', 'booster', 'seasonal'],
        required: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    effectDuration: {
        type: Number,  // Duration in hours
        default: 12    // Default for time extension is 12 hours
    },
    boostPercentage: {
        type: Number,  // For booster pass
        default: 25    // 25% boost (1.25x)
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

module.exports = mongoose.model('Pass', passSchema);