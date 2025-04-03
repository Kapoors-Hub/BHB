// models/BountyResult.js
const mongoose = require('mongoose');

const bountyResultSchema = new mongoose.Schema({
  bounty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bounty',
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lord',
    required: true
  },
  postedAt: {
    type: Date,
    default: Date.now
  },
  rankings: [{
    hunter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hunter'
    },
    rank: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    scores: {
      adherenceToBrief: Number,
      conceptualThinking: Number,
      technicalExecution: Number,
      originalityCreativity: Number,
      documentation: Number
    },
    xpEarned: Number,
    rewardEarned: Number
  }],
  nonSubmitters: [{
    hunter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hunter'
    },
    foulApplied: {
      type: Boolean,
      default: true
    },
    foulRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoulRecord'
    }
  }]
});

// Index for faster querying
bountyResultSchema.index({ bounty: 1 });
bountyResultSchema.index({ 'rankings.hunter': 1 });

module.exports = mongoose.model('BountyResult', bountyResultSchema);