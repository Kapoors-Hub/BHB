// models/Quiz.js
const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    text: String,
    imageUrl: String,
    isCorrect: {
        type: Boolean,
        default: false
    }
});

const questionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true
    },
    radio:Boolean,
    image:Boolean,
    imageUrl: String,
    options: [optionSchema],
    explanation: String
});

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    totalQuestions: {
        type: Number,
        required: [true, 'Total number of questions is required']
    },
    timeDuration: {
        type: Number,  // In seconds
        default: 0
    },
    timeLimited: {
        type: Boolean,
        default: false
    },
    questions: [questionSchema],
    category: {
        type: String,
        required: [true, 'Category is required']
    },
    active: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt on save
quizSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Quiz', quizSchema);