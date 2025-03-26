// controllers/hunterQuizController.js
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Hunter = require('../models/Hunter');

const hunterQuizController = {
    // Start a new quiz attempt
    async startQuiz(req, res) {
        try {
            const { quizId } = req.params;
            const hunterId = req.hunter.id;

            // Find the quiz
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }

            // Check if quiz is active
            if (!quiz.active) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'This quiz is not currently available'
                });
            }

            // Check if hunter already has an active attempt for this quiz
            const existingAttempt = await QuizAttempt.findOne({
                quiz: quizId,
                hunter: hunterId,
                completedAt: { $exists: false }
            });

            if (existingAttempt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'You already have an active attempt for this quiz',
                    data: {
                        attemptId: existingAttempt._id,
                        startedAt: existingAttempt.startedAt
                    }
                });
            }

            // Create new quiz attempt
            const quizAttempt = await QuizAttempt.create({
                quiz: quizId,
                hunter: hunterId,
                startedAt: new Date(),
                totalQuestions: quiz.totalQuestions
            });

            // Prepare quiz data for client - remove correct answers
            const quizData = {
                _id: quiz._id,
                title: quiz.title,
                description: quiz.description,
                timeDuration: quiz.timeLimited ? quiz.timeDuration : 0,
                timeLimited: quiz.timeLimited,
                totalQuestions: quiz.totalQuestions,
                questions: quiz.questions.map(q => ({
                    _id: q._id,
                    questionText: q.questionText,
                    imageUrl: q.imageUrl,
                    options: q.options.map(o => ({
                        _id: o._id,
                        text: o.text,
                        imageUrl: o.imageUrl
                        // isCorrect is removed for client
                    }))
                    // explanation is removed for client until completion
                }))
            };

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Quiz started successfully',
                data: {
                    quizAttemptId: quizAttempt._id,
                    quiz: quizData,
                    startedAt: quizAttempt.startedAt
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error starting quiz',
                error: error.message
            });
        }
    },

    // Get all available quizzes for hunters
    async getAvailableQuizzes(req, res) {
        try {
            const hunterId = req.hunter.id;

            // Get active quizzes
            const quizzes = await Quiz.find({ active: true })
                .select('title description totalQuestions timeDuration timeLimited category createdAt');

            // Get completed attempts for this hunter
            const completedAttempts = await QuizAttempt.find({
                hunter: hunterId,
                completedAt: { $exists: true }
            }).select('quiz xpEarned correctAnswers totalQuestions');

            // Map quiz data with completion info
            const availableQuizzes = quizzes.map(quiz => {
                const attempt = completedAttempts.find(a =>
                    a.quiz.toString() === quiz._id.toString()
                );

                return {
                    _id: quiz._id,
                    title: quiz.title,
                    description: quiz.description,
                    totalQuestions: quiz.totalQuestions,
                    timeDuration: quiz.timeDuration,
                    timeLimited: quiz.timeLimited,
                    category: quiz.category,
                    maxPossibleXP: quiz.totalQuestions * 25,
                    attempted: !!attempt,
                    score: attempt ? attempt.correctAnswers / attempt.totalQuestions * 100 : null,
                    xpEarned: attempt ? attempt.xpEarned : null
                };
            });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Available quizzes retrieved successfully',
                data: {
                    count: availableQuizzes.length,
                    quizzes: availableQuizzes
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving available quizzes',
                error: error.message
            });
        }
    },

// Get a single quiz by ID
async getSingleQuiz(req, res) {
    try {
      const { quizId } = req.params;
      const hunterId = req.hunter.id;
  
      // Find the quiz
      const quiz = await Quiz.findById(quizId)
        .populate('createdBy', 'username');
  
      if (!quiz) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Quiz not found'
        });
      }
  
      // Check if quiz is active
      if (!quiz.active) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'This quiz is not currently active'
        });
      }
  
      // Check if hunter has already taken this quiz
      const quizAttempt = await QuizAttempt.findOne({
        quiz: quizId,
        hunter: hunterId,
        completed: true
      });
  
      const hasCompleted = !!quizAttempt;
  
      // Include questions with their complete information
      const questions = quiz.questions.map(question => {
        return {
          _id: question._id,
          questionText: question.questionText,
          imageUrl: question.imageUrl,
          options: question.options, // Include all option details including isCorrect
          explanation: question.explanation
        };
      });
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Quiz retrieved successfully',
        data: {
          quiz: {
            _id: quiz._id,
            title: quiz.title,
            description: quiz.description,
            totalQuestions: quiz.totalQuestions,
            timeDuration: quiz.timeDuration,
            timeLimited: quiz.timeLimited,
            category: quiz.category,
            active: quiz.active,
            createdBy: quiz.createdBy,
            createdAt: quiz.createdAt,
            hasCompleted
          },
          questions: hasCompleted ? [] : questions // Only include questions if not completed
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving quiz',
        error: error.message
      });
    }
  },

    // Get a hunter's quiz history
    async getQuizHistory(req, res) {
        try {
            const hunterId = req.hunter.id;

            const attempts = await QuizAttempt.find({
                hunter: hunterId,
                completedAt: { $exists: true }
            })
                .populate('quiz', 'title totalQuestions')
                .sort({ completedAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz history retrieved successfully',
                data: {
                    count: attempts.length,
                    totalXPEarned: attempts.reduce((sum, a) => sum + a.xpEarned, 0),
                    attempts: attempts.map(a => ({
                        quizAttemptId: a._id,
                        quiz: {
                            id: a.quiz._id,
                            title: a.quiz.title
                        },
                        completedAt: a.completedAt,
                        correctAnswers: a.correctAnswers,
                        totalQuestions: a.totalQuestions,
                        percentageScore: a.percentageScore,
                        xpEarned: a.xpEarned,
                        timeSpent: a.timeSpent
                    }))
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving quiz history',
                error: error.message
            });
        }
    },

    async completeQuiz(req, res) {
        try {
            const { quizAttemptId } = req.params;
            const { answers } = req.body;
            const hunterId = req.hunter.id;
    
            // Find the attempt with more lenient conditions for better error handling
            const attempt = await QuizAttempt.findOne({
                _id: quizAttemptId,
                hunter: hunterId
            });
    
            if (!attempt) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz attempt not found'
                });
            }
    
            // Check if already completed
            if (attempt.completedAt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Quiz attempt already completed'
                });
            }
    
            // Get the quiz
            const quiz = await Quiz.findById(attempt.quiz);
            if (!quiz) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Quiz not found'
                });
            }
    
            // Process answers
            let correctAnswers = 0;
            const processedAnswers = [];
    
            // Validate and process each answer
            for (const answer of answers) {
                const { questionId, selectedOptionIds } = answer;
    
                // Find the question
                const question = quiz.questions.id(questionId);
                if (!question) continue;
    
                // Check if answer is correct
                const correctOptionIds = question.options
                    .filter(opt => opt.isCorrect)
                    .map(opt => opt._id.toString());
    
                // Simple check - arrays must match exactly (for multiple correct answers)
                const isCorrect =
                    selectedOptionIds.length === correctOptionIds.length &&
                    selectedOptionIds.every(id => correctOptionIds.includes(id));
    
                if (isCorrect) correctAnswers++;
    
                processedAnswers.push({
                    questionId,
                    selectedOptions: selectedOptionIds,
                    isCorrect,
                    pointsEarned: isCorrect ? 25 : 0  // 25 points per correct answer
                });
            }
    
            // Update the attempt
            attempt.answers = processedAnswers;
            attempt.completedAt = new Date();
            attempt.correctAnswers = correctAnswers;
            attempt.totalQuestions = quiz.totalQuestions;
            attempt.xpEarned = correctAnswers * 25;  // 25 XP per correct answer
    
            await attempt.save();
    
            // Get hunter before XP update to track level changes
            const hunterBefore = await Hunter.findById(hunterId);
            const previousLevel = {
                tier: hunterBefore.level.tier,
                rank: hunterBefore.level.rank
            };
            const previousXP = hunterBefore.xp;
    
            // Update hunter's XP and trigger level update through save (not findByIdAndUpdate)
            hunterBefore.xp += attempt.xpEarned;
            await hunterBefore.save(); // This will trigger the pre-save hook to update level
    
            // Get updated hunter to check new level
            const hunterAfter = await Hunter.findById(hunterId);
            const levelChanged = 
                previousLevel.tier !== hunterAfter.level.tier || 
                previousLevel.rank !== hunterAfter.level.rank;
    
            // Create notification for quiz completion
            await notificationController.createNotification({
                hunterId: hunterId,
                title: 'Quiz Completed',
                message: `You've completed "${quiz.title}" quiz and earned ${attempt.xpEarned} XP.`,
                type: 'quiz'
            });
    
            // Send level up notification if applicable
            if (levelChanged) {
                await notificationController.createNotification({
                    hunterId: hunterId,
                    title: 'Level Up',
                    message: `Congratulations! You've reached ${hunterAfter.level.tier} ${hunterAfter.level.rank}.`,
                    type: 'level'
                });
            }
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Quiz completed successfully',
                data: {
                    correctAnswers,
                    totalQuestions: quiz.totalQuestions,
                    percentageScore: Math.round((correctAnswers / quiz.totalQuestions) * 100),
                    xpEarned: attempt.xpEarned,
                    timeTaken: attempt.timeSpent,
                    previousXP,
                    newXP: hunterAfter.xp,
                    previousLevel,
                    newLevel: {
                        tier: hunterAfter.level.tier,
                        rank: hunterAfter.level.rank
                    },
                    levelChanged
                }
            });
        } catch (error) {
            console.error('Error completing quiz:', error);
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error completing quiz',
                error: error.message
            });
        }
    }

    // async completeQuiz(req, res) {
    //     try {
    //         const { quizAttemptId } = req.params;
    //         const { answers } = req.body;
    //         const hunterId = req.hunter.id;
    //         console.log(quizAttemptId)
    //         // Find the attempt
    //         const attempt = await QuizAttempt.findOne({
    //             _id: quizAttemptId,
    //             hunter: hunterId,
    //             completedAt: { $exists: false }  // Not already completed
    //         });

    //         if (!attempt) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Active quiz attempt not found'
    //             });
    //         }

    //         // Get the quiz
    //         const quiz = await Quiz.findById(attempt.quiz);
    //         if (!quiz) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Quiz not found'
    //             });
    //         }

    //         // Process answers
    //         let correctAnswers = 0;
    //         const processedAnswers = [];

    //         // Validate and process each answer
    //         for (const answer of answers) {
    //             const { questionId, selectedOptionIds } = answer;

    //             // Find the question
    //             const question = quiz.questions.id(questionId);
    //             if (!question) continue;

    //             // Check if answer is correct
    //             const correctOptionIds = question.options
    //                 .filter(opt => opt.isCorrect)
    //                 .map(opt => opt._id.toString());

    //             // Simple check - arrays must match exactly (for multiple correct answers)
    //             const isCorrect =
    //                 selectedOptionIds.length === correctOptionIds.length &&
    //                 selectedOptionIds.every(id => correctOptionIds.includes(id));

    //             if (isCorrect) correctAnswers++;

    //             processedAnswers.push({
    //                 questionId,
    //                 selectedOptions: selectedOptionIds,
    //                 isCorrect,
    //                 pointsEarned: isCorrect ? 25 : 0  // 25 points per correct answer
    //             });
    //         }

    //         // Update the attempt
    //         attempt.answers = processedAnswers;
    //         attempt.completedAt = new Date();
    //         attempt.correctAnswers = correctAnswers;
    //         attempt.totalQuestions = quiz.totalQuestions;
    //         attempt.xpEarned = correctAnswers * 25;  // 25 XP per correct answer

    //         await attempt.save();

    //         // Update hunter's XP
    //         await Hunter.findByIdAndUpdate(
    //             hunterId,
    //             { $inc: { xp: attempt.xpEarned } }
    //         );

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Quiz completed successfully',
    //             data: {
    //                 correctAnswers,
    //                 totalQuestions: quiz.totalQuestions,
    //                 percentageScore: Math.round((correctAnswers / quiz.totalQuestions) * 100),
    //                 xpEarned: attempt.xpEarned,
    //                 timeTaken: attempt.timeSpent
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error completing quiz',
    //             error: error.message
    //         });
    //     }
    // }
}

module.exports = hunterQuizController;