const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const lordSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true
      },
    password: {
        type: String,
        required: [true, 'Password is required'],
        select: false
    },
    bounties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bounty'
    }],
    resetPasswordOtp: {
        code: String,
        expiresAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
lordSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

module.exports = mongoose.model('Lord', lordSchema);