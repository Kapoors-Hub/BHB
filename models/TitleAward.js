// // models/TitleAward.js
// const mongoose = require('mongoose');

// const titleAwardSchema = new mongoose.Schema({
//     title: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Title',
//         required: true
//     },
//     hunter: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Hunter',
//         required: true
//     },
//     month: {
//         type: Number,
//         required: true,
//         min: 1,
//         max: 12
//     },
//     year: {
//         type: Number,
//         required: true
//     },
//     awardedAt: {
//         type: Date,
//         default: Date.now
//     },
//     validFrom: {
//         type: Date,
//         required: true
//     },
//     validUntil: {
//         type: Date,
//         required: true
//     },
//     awardedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Admin',
//         required: true
//     },
//     reason: String
// });

// // Compound unique index to ensure one title per hunter per month
// titleAwardSchema.index({ title: 1, month: 1, year: 1 }, { unique: true });

// module.exports = mongoose.model('TitleAward', titleAwardSchema);

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
    validUntil: {
        type: Date,
        required: true
    },
    awardedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    reason: String,
    isRevoked: {
        type: Boolean,
        default: false
    },
    revokedAt: Date
});

// Set validUntil date before saving
titleAwardSchema.pre('save', function(next) {
    if (this.isNew) {
        // Calculate the 7th of the next month for validUntil
        const nextMonth = new Date();
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1); // Move to next month
        nextMonth.setUTCDate(7); // Set to 7th of that month
        nextMonth.setUTCHours(0, 0, 0, 0); // Set to midnight
        
        this.validUntil = nextMonth;
        
        // Set awardedAt to be the 8th of current month if not provided
        if (!this.awardedAt) {
            const currentMonth = new Date();
            currentMonth.setUTCDate(8); // Set to 8th of current month
            currentMonth.setUTCHours(0, 0, 0, 0); // Set to midnight
            this.awardedAt = currentMonth;
        }
        
        // Set month and year based on awardedAt if not provided
        if (!this.month || !this.year) {
            this.month = this.awardedAt.getUTCMonth() + 1; // getMonth is 0-based
            this.year = this.awardedAt.getUTCFullYear();
        }
    }
    next();
});

// Compound unique index to ensure one title per hunter per month
titleAwardSchema.index({ title: 1, hunter: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('TitleAward', titleAwardSchema);