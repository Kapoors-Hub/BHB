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
  wallet: {
    type: Number,
    default: 0
  },
  totalEarnings: {  
    type: Number,
    default: 0
  },
  xp: {
    type: Number,
    default: 375
  },
  performance: {
    score: {
      type: Number,
      default: 0
    },
    bountyScores: [{
      bounty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bounty'
      },
      score: Number,
      calculatedAt: {
        type: Date,
        default: Date.now
      }
    }],
    totalBountiesCalculated: {
      type: Number,
      default: 0
    }
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
  badges: [{
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  titles: [{
    title: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Title'
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
      ref: 'Admin'
    }
  }],

  passes: {
    timeExtension: {
      count: {
        type: Number,
        default: 1  // One pass received every month
      },
      lastResetDate: {
        type: Date,
        default: Date.now
      }
    },
    resetFoul: {
      count: {
        type: Number,
        default: 0  // Earned on winning a bounty
      }
    },
    booster: {
      count: {
        type: Number,
        default: 0  // Earned on 2 consecutive wins
      }
    },
    seasonal: {
      count: {
        type: Number,
        default: 0  // Received by top performers at season end
      },
      lastAwarded: Date
    },
    // Track consecutive wins for booster pass
    consecutiveWins: {
      type: Number,
      default: 0
    }
  },
  achievements: {
    bountiesWon: {
      count: { type: Number, default: 0 },
      bountyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bounty' }]
    },
    lastPlaceFinishes: {
      count: { type: Number, default: 0 },
      bountyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bounty' }]
    },
    firstSubmissions: {
      count: { type: Number, default: 0 },
      bountyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bounty' }]
    },
    nonProfitBounties: {
      count: { type: Number, default: 0 },
      bountyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bounty' }]
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
  quitBounties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bounty'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'verified'],
    default: 'pending'
  },
  issues: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue'
  }],
  // issues: [{
  //   type: {
  //     type: String,
  //     required: [true, 'Issue type is required'],
  //     enum: ['Technical Issue ', 'Payment Issue', 'Project and Work Submission', 'Other', "Account & Profile", "Hunter/Lord Behavior", "General Inquiry"]
  //   },
  //   query: {
  //     type: String,
  //     required: [true, 'Query description is required']
  //   },
  //   attachedFiles: [{
  //     fileName: String,
  //     filePath: String,
  //     uploadedAt: {
  //       type: Date,
  //       default: Date.now
  //     }
  //   }],
  //   status: {
  //     type: String,
  //     enum: ['open', 'in-progress', 'resolved', 'closed'],
  //     default: 'open'
  //   },
  //   responses: [{
  //     message: {
  //       type: String,
  //       required: true
  //     },
  //     sender: {
  //       id: {
  //         type: mongoose.Schema.Types.ObjectId,
  //         refPath: 'issues.responses.sender.role'
  //       },
  //       role: {
  //         type: String,
  //         enum: ['Admin', 'Lord', 'Hunter']
  //       },
  //       name: String
  //     },
  //     attachedFiles: [{
  //       fileName: String,
  //       filePath: String,
  //       uploadedAt: {
  //         type: Date,
  //         default: Date.now
  //       }
  //     }],
  //     createdAt: {
  //       type: Date,
  //       default: Date.now
  //     }
  //   }],
  //   createdAt: {
  //     type: Date,
  //     default: Date.now
  //   },
  //   resolvedAt: Date,
  //   adminResponse: String,
  //   adminId: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'Admin'
  //   }
  // }],
  strikes: {
    count: {
      type: Number,
      default: 0
    },
    suspensionHistory: [{
      startDate: Date,
      endDate: Date,
      reason: String
    }],
    isCurrentlySuspended: {
      type: Boolean,
      default: false
    },
    suspensionEndDate: Date
  },
  otp: {
    code: String,
    expiresAt: Date
  },
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

hunterSchema.methods.updateLevel = function () {
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

hunterSchema.pre('save', function (next) {
  if (this.isModified('xp')) {
    this.updateLevel();
  }
  next();
});

hunterSchema.pre('save', function (next) {
  if (this.isModified('xp')) {
    this.updateLevel();
  }
  next();
});

module.exports = mongoose.model('Hunter', hunterSchema);