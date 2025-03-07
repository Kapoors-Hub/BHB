// controllers/quizController.js
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const upload = require('../config/multer');

const quizController = {
    // Create a new quiz
async createQuiz(req, res) {
    try {
        const {
            title,
            description,
            totalQuestions,
            timeDuration,
            timeLimited,
            questions,
            category
        } = req.body;
        
        // Validate input
        if (!title || !description || !questions || !category) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Required fields missing'
            });
        }
        
        // Validate questions
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Questions must be a non-empty array'
            });
        }
        
        // Validate each question has a correct option
        for (const question of questions) {
            if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Each question must have at least 2 options'
                });
            }
            
            const hasCorrectOption = question.options.some(option => option.isCorrect);
            if (!hasCorrectOption) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Each question must have at least one correct option'
                });
            }
        }
        
        // Create the quiz
        const quiz = await Quiz.create({
            title,
            description,
            totalQuestions: questions.length,
            timeDuration: timeDuration || 0,
            timeLimited: timeLimited || false,
            questions,
            category,
            createdBy: req.admin.id
        });
        
        // Calculate potential maximum XP (25 per question)
        const maxPossibleXP = quiz.totalQuestions * 25;
        
        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Quiz created successfully',
            data: {
                quizId: quiz._id,
                title: quiz.title,
                totalQuestions: quiz.totalQuestions,
                maxPossibleXP
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error creating quiz',
            error: error.message
        });
    }
},

    // Update an existing quiz
    async updateQuiz(req, res) {
        try {
            const { quizId } = req.params;
            const updateData = req.body;
            
            // Find the quiz
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }
            
            // Check if questions are being updated
            if (updateData.questions) {
                // Validate each question has a correct option
                for (const question of updateData.questions) {
                    if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
                        return res.status(400).json({
                            status: 400,
                            success: false,
                            message: 'Each question must have at least 2 options'
                        });
                    }
                    
                    const hasCorrectOption = question.options.some(option => option.isCorrect);
                    if (!hasCorrectOption) {
                        return res.status(400).json({
                            status: 400,
                            success: false,
                            message: 'Each question must have at least one correct option'
                        });
                    }
                }
                
                // Update total questions count
                updateData.totalQuestions = updateData.questions.length;
            }
            
            // Update the quiz
            const updatedQuiz = await Quiz.findByIdAndUpdate(
                quizId,
                updateData,
                { new: true, runValidators: true }
            );
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz updated successfully',
                data: {
                    quizId: updatedQuiz._id,
                    title: updatedQuiz.title,
                    totalQuestions: updatedQuiz.totalQuestions,
                    xpReward: updatedQuiz.xpReward
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating quiz',
                error: error.message
            });
        }
    },

    // Get all quizzes (admin view)
    async getAllQuizzes(req, res) {
        try {
            const quizzes = await Quiz.find()
                .select('-questions')
                .sort({ createdAt: -1 });
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quizzes retrieved successfully',
                data: {
                    count: quizzes.length,
                    quizzes
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving quizzes',
                error: error.message
            });
        }
    },

    // Get quiz details (admin view)
    async getQuizDetails(req, res) {
        try {
            const { quizId } = req.params;
            
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz details retrieved successfully',
                data: quiz
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving quiz details',
                error: error.message
            });
        }
    },

    // Delete a quiz
    async deleteQuiz(req, res) {
        try {
            const { quizId } = req.params;
            
            // Check if quiz exists
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }
            
            // Check if any hunters have attempted the quiz
            const attempts = await QuizAttempt.countDocuments({ quiz: quizId });
            if (attempts > 0) {
                // Instead of deleting, mark as inactive
                await Quiz.findByIdAndUpdate(quizId, { active: false });
                
                return res.status(200).json({
                    status: 200,
                    success: true,
                    message: 'Quiz marked as inactive since it has attempts'
                });
            }
            
            // No attempts, safe to delete
            await Quiz.findByIdAndDelete(quizId);
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting quiz',
                error: error.message
            });
        }
    },

    // Upload quiz question image (admin)
    async uploadQuestionImage(req, res) {
        upload.single('image')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Error uploading image',
                    error: err.message
                });
            }
            
            if (!req.file) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'No image file provided'
                });
            }
            
            // Get file details
            const filePath = req.file.path;
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Image uploaded successfully',
                data: {
                    imageUrl: filePath
                }
            });
        });
    },

    // Get quiz statistics (admin view)
    async getQuizStatistics(req, res) {
        try {
            const { quizId } = req.params;
            
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }
            
            // Fetch attempts
            const attempts = await QuizAttempt.find({ quiz: quizId })
                .populate('hunter', 'username name');
            
            // Calculate statistics
            const totalAttempts = attempts.length;
            const completedAttempts = attempts.filter(a => a.completedAt).length;
            const averageScore = attempts.length > 0
                ? attempts.reduce((sum, a) => sum + (a.percentageScore || 0), 0) / attempts.length
                : 0;
            
            // Question-specific stats
            const questionStats = [];
            for (let i = 0; i < quiz.questions.length; i++) {
                const question = quiz.questions[i];
                const attemptsForQuestion = attempts
                    .filter(a => a.answers.some(ans => ans.questionId.toString() === question._id.toString()));
                
                const correctCount = attemptsForQuestion
                    .filter(a => a.answers.find(ans => 
                        ans.questionId.toString() === question._id.toString() && ans.isCorrect
                    )).length;
                
                questionStats.push({
                    questionId: question._id,
                    questionText: question.questionText,
                    attemptCount: attemptsForQuestion.length,
                    correctCount,
                    correctPercentage: attemptsForQuestion.length > 0
                        ? (correctCount / attemptsForQuestion.length) * 100
                        : 0
                });
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz statistics retrieved successfully',
                data: {
                    quizId,
                    quizTitle: quiz.title,
                    totalAttempts,
                    completedAttempts,
                    averageScore,
                    questionStats,
                    recentAttempts: attempts.slice(0, 10).map(a => ({
                        hunter: {
                            id: a.hunter._id,
                            username: a.hunter.username,
                            name: a.hunter.name
                        },
                        completedAt: a.completedAt,
                        percentageScore: a.percentageScore,
                        timeSpent: a.timeSpent
                    }))
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving quiz statistics',
                error: error.message
            });
        }
    }
};

module.exports = quizController;