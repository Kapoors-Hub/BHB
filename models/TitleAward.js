// models/TitleAward.js
const mongoose = require('mongoose');

const titleAwardSchema = new mongoose.Schema({
    title: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Title',
        required: true
    },
    hunter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter',
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    awardedAt: {
        type: Date,
        default: Date.now
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    awardedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    reason: String
});

// Compound unique index to ensure one title per hunter per month
titleAwardSchema.index({ title: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('TitleAward', titleAwardSchema);