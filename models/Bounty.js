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
    days: {
        type: Number,
        default: 0
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
        extendedEndTime: Date, // For time extension pass
        boosterActive: {
            type: Boolean,
            default: false
        },
        submission: {
            description: String,
            files: [{
                fileName: String,
                filePath: String,
                uploadedAt: Date
            }],
            submittedAt: Date,
            review: {
                adherenceToBrief: {
                    type: Number,
                    min: 0,
                    max: 5
                },
                conceptualThinking: {
                    type: Number,
                    min: 0,
                    max: 5
                },
                technicalExecution: {
                    type: Number,
                    min: 0,
                    max: 5
                },
                originalityCreativity: {
                    type: Number,
                    min: 0,
                    max: 5
                },
                documentation: {
                    type: Number,
                    min: 0,
                    max: 5
                },
                totalScore: {
                    type: Number,
                    min: 0,
                    max: 25
                },
                feedback: String,
                reviewedAt: Date,
                reviewedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Lord'
                }
            }
        }
    }],
    shortlistedHunters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter'
    }],
    evaluatedHunters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter'
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

// Pre-save middleware to calculate days
bountySchema.pre('save', function (next) {
    if (this.startTime && this.endTime) {
        const startDate = new Date(this.startTime);
        const endDate = new Date(this.endTime);

        // Calculate difference in milliseconds
        const differenceMs = endDate - startDate;

        // Convert milliseconds to days
        this.days = Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
    }
    next();
});

module.exports = mongoose.model('Bounty', bountySchema);