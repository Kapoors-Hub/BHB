const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bankAccountSchema = new mongoose.Schema({
    accountHolderName: {
        type: String,
        required: [true, 'Account holder name is required']
    },
    ifscNumber: {
        type: String,
        required: [true, 'IFSC number is required']
    },
    accountNumber: {
        type: String,
        required: [true, 'Account number is required'],
        unique: true
    },
    firstName: {
        type: String,
        required: [true, 'First name is required']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required']
    },
    address: {
        type: String,
        required: [true, 'Address is required']
    },
    city: {
        type: String,
        required: [true, 'City is required']
    },
    postalCode: {
        type: String,
        required: [true, 'Postal code is required']
    },
    country: {
        type: String,
        required: [true, 'Country is required']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required']
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

const lordSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true
    },
    firstName: {
        type: String,
        required: [true, 'First name is required']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required']
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
    bankAccounts: [bankAccountSchema],
    issues: [{
        type: {
            type: String,
            required: [true, 'Issue type is required'],
            enum: ['technical', 'payment', 'content', 'other']
        },
        query: {
            type: String,
            required: [true, 'Query description is required']
        },
        attachedFiles: [{
            fileName: String,
            filePath: String,
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],
        status: {
            type: String,
            enum: ['open', 'in-progress', 'resolved', 'closed'],
            default: 'open'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        resolvedAt: Date,
        adminResponse: String,
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    }],
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