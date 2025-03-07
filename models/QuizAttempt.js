// models/QuizAttempt.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    selectedOptions: [{
        type: mongoose.Schema.Types.ObjectId
    }],
    isCorrect: {
        type: Boolean,
        default: false
    },
    pointsEarned: {
        type: Number,
        default: 0
    }
});

const quizAttemptSchema = new mongoose.Schema({
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    hunter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hunter',
        required: true
    },
    answers: [answerSchema],
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    timeSpent: Number, // In seconds
    totalPoints: {
        type: Number,
        default: 0
    },
    xpEarned: {
        type: Number,
        default: 0
    },
    correctAnswers: {
        type: Number,
        default: 0
    },
    totalQuestions: Number,
    percentageScore: Number
});

// Calculate stats when completed
quizAttemptSchema.pre('save', function(next) {
    if (this.completedAt && !this.timeSpent) {
        this.timeSpent = Math.round(
            (this.completedAt - this.startedAt) / 1000
        );
    }
    
    if (this.isModified('answers')) {
        this.correctAnswers = this.answers.filter(a => a.isCorrect).length;
        this.totalPoints = this.answers.reduce((sum, a) => sum + a.pointsEarned, 0);
        
        if (this.totalQuestions) {
            this.percentageScore = Math.round(
                (this.correctAnswers / this.totalQuestions) * 100
            );
        }
    }
    
    next();
});

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);