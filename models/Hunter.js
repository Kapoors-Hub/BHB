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

module.exports = mongoose.model('Hunter', hunterSchema);