const mongoose = require('mongoose');

const hunterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  collegeName: {
    type: String,
    required: [true, 'College name is required']
  },
  collegeEmail: {
    type: String,
    required: [true, 'College email is required'],
    unique: true,
    lowercase: true
  },
  personalEmail: {
    type: String,
    required: [true, 'Personal email is required'],
    unique: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true
  },
  discipline: {
    type: String,
    required: [true, 'Discipline is required']
  },
  graduatingYear: {
    type: Number,
    required: [true, 'Graduating year is required']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  postalZipCode: {
    type: String,
    required: [true, 'Postal/ZIP code is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    select: false  // Password won't be returned in queries
  },
  guild: {
    type: String
  },
  placeOfResidence: {
    type: String
  },
  xp: {
    type: Number,
    default: 375
  },
  level: {
    tier: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold'],
        default: 'Bronze'
    },
    rank: {
        type: String,
        enum: ['Novice', 'Specialist', 'Master'],
        default: 'Novice'
    }
},
  questions: [{
    question: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      required: true
    }
  }],
  acceptedBounties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bounty'
}],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'verified'],
    default: 'pending'
  },
  otp: {
    code: String,
    expiresAt: Date
  },
  // In Hunter model
resetPasswordOtp: {
    code: String,
    expiresAt: Date
},
  isVerified: {
    type: Boolean,
    default: false
  },
  adminRemarks: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Discarded But Good Logic
// hunterSchema.methods.updateLevel = function() {
//   const xp = this.xp;
//   let tier, rank;

//   // Define XP thresholds for each tier
//   const BRONZE_MAX = 18000;
//   const SILVER_MAX = 42000;
//   const GOLD_MAX = 72000;

//   // Define rank thresholds within each tier
//   const SPECIALIST_THRESHOLD = 0.33; // 33% of tier range
//   const MASTER_THRESHOLD = 0.66;     // 66% of tier range

//   if (xp < BRONZE_MAX) {
//       tier = 'Bronze';
//       const tierProgress = xp / BRONZE_MAX;
      
//       if (tierProgress < SPECIALIST_THRESHOLD) rank = 'Novice';
//       else if (tierProgress < MASTER_THRESHOLD) rank = 'Specialist';
//       else rank = 'Master';
//   }
//   else if (xp < SILVER_MAX) {
//       tier = 'Silver';
//       const tierProgress = (xp - BRONZE_MAX) / (SILVER_MAX - BRONZE_MAX);
      
//       if (tierProgress < SPECIALIST_THRESHOLD) rank = 'Novice';
//       else if (tierProgress < MASTER_THRESHOLD) rank = 'Specialist';
//       else rank = 'Master';
//   }
//   else {
//       tier = 'Gold';
//       const tierProgress = (xp - SILVER_MAX) / (GOLD_MAX - SILVER_MAX);
      
//       if (tierProgress < SPECIALIST_THRESHOLD) rank = 'Novice';
//       else if (tierProgress < MASTER_THRESHOLD) rank = 'Specialist';
//       else rank = 'Master';
//   }

//   this.level.tier = tier;
//   this.level.rank = rank;
// };

hunterSchema.methods.updateLevel = function() {
  const xp = this.xp;
  let tier, rank;

  // Bronze Tier (0-18k)
  if (xp < 18000) {
      tier = 'Bronze';
      if (xp < 6000) rank = 'Novice';
      else if (xp < 12000) rank = 'Specialist';
      else rank = 'Master';
  }
  // Silver Tier (18k-42k)
  else if (xp < 42000) {
      tier = 'Silver';
      if (xp < 26000) rank = 'Novice';
      else if (xp < 34000) rank = 'Specialist';
      else rank = 'Master';
  }
  // Gold Tier (42k-72k)
  else {
      tier = 'Gold';
      if (xp < 52000) rank = 'Novice';
      else if (xp < 62000) rank = 'Specialist';
      else rank = 'Master';
  }

  this.level.tier = tier;
  this.level.rank = rank;
};

hunterSchema.pre('save', function(next) {
  if (this.isModified('xp')) {
      this.updateLevel();
  }
  next();
});

module.exports = mongoose.model('Hunter', hunterSchema);