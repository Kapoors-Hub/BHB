const mongoose = require('mongoose');

// Pass Types Schema - This defines the available pass types
const passTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pass type name is required'],
    unique: true,
    enum: ['timeExtension', 'cleanSlate', 'booster', 'seasonal'],
    trim: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  effectDuration: {
    type: Number,  // Duration in hours (for time extension)
    default: null
  },
  boostPercentage: {
    type: Number,  // For booster pass
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  availabilityRule: {
    type: String,
    enum: ['monthly', 'bountyWin', 'consecutiveWins', 'seasonTop'],
    required: true
  },
  stackable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hunter Pass Inventory Schema - This tracks passes owned by hunters
const hunterPassSchema = new mongoose.Schema({
  hunter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hunter',
    required: true
  },
  passType: {
    type: String,
    enum: ['timeExtension', 'cleanSlate', 'booster', 'seasonal'],
    required: true
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Pass Usage Record Schema - This tracks when passes are used
const passUsageSchema = new mongoose.Schema({
  hunter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hunter',
    required: true
  },
  passType: {
    type: String,
    enum: ['timeExtension', 'cleanSlate', 'booster', 'seasonal'],
    required: true
  },
  usedAt: {
    type: Date,
    default: Date.now
  },
  bounty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bounty',
    default: null
  },
  foulRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoulRecord',
    default: null
  },
  effect: {
    extendedHours: Number,  // For time extension
    boostPercentage: Number, // For booster
    foulCleared: Boolean,   // For clean slate
    seasonalBenefits: [String] // For seasonal
  }
});

// Monthly Reset Tracking
const passResetSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  huntersProcessed: {
    type: Number,
    default: 0
  }
});

// Compound index to ensure unique monthly records
passResetSchema.index({ month: 1, year: 1 }, { unique: true });

// Compound index for hunter pass inventory
hunterPassSchema.index({ hunter: 1, passType: 1 }, { unique: true });

const PassType = mongoose.model('PassType', passTypeSchema);
const HunterPass = mongoose.model('HunterPass', hunterPassSchema);
const PassUsage = mongoose.model('PassUsage', passUsageSchema);
const PassReset = mongoose.model('PassReset', passResetSchema);

module.exports = {
  PassType,
  HunterPass,
  PassUsage,
  PassReset
};