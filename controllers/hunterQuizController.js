// controllers/hunterQuizController.js
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Hunter = require('../models/Hunter');
const notificationController = require('./notificationController');
const { default: mongoose } = require('mongoose');

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
    // async getAvailableQuizzes(req, res) {
    //     try {
    //         const hunterId = req.hunter.id;

    //         // Get active quizzes
    //         const quizzes = await Quiz.find({ active: true })
    //             .select('title description totalQuestions timeDuration timeLimited category createdAt');

    //         // Get completed attempts for this hunter
    //         const completedAttempts = await QuizAttempt.find({
    //             hunter: hunterId,
    //             completedAt: { $exists: true }
    //         }).select('quiz xpEarned correctAnswers totalQuestions');

    //         // Map quiz data with completion info
    //         const availableQuizzes = quizzes.map(quiz => {
    //             const attempt = completedAttempts.find(a =>
    //                 a.quiz.toString() === quiz._id.toString()
    //             );

    //             return {
    //                 _id: quiz._id,
    //                 title: quiz.title,
    //                 description: quiz.description,
    //                 totalQuestions: quiz.totalQuestions,
    //                 timeDuration: quiz.timeDuration,
    //                 timeLimited: quiz.timeLimited,
    //                 category: quiz.category,
    //                 maxPossibleXP: quiz.totalQuestions * 25,
    //                 attempted: !!attempt,
    //                 score: attempt ? attempt.correctAnswers / attempt.totalQuestions * 100 : null,
    //                 xpEarned: attempt ? attempt.xpEarned : null
    //             };
    //         });

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Available quizzes retrieved successfully',
    //             data: {
    //                 count: availableQuizzes.length,
    //                 quizzes: availableQuizzes
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error retrieving available quizzes',
    //             error: error.message
    //         });
    //     }
    // },

    async getAvailableQuizzes(req, res) {
        try {
            const hunterId = req.hunter.id;
    
            // Get ALL attempts for this hunter, not just completed ones
            const attempts = await QuizAttempt.find({
                hunter: hunterId
            }).select('quiz');
    
            // Get IDs of all attempted quizzes
            const attemptedQuizIds = attempts.map(attempt => attempt.quiz.toString());
    
            // Get active quizzes that haven't been attempted by this hunter
            const quizzes = await Quiz.find({ 
                active: true,
                _id: { $nin: attemptedQuizIds } // Exclude all attempted quizzes
            }).select('title description totalQuestions timeDuration timeLimited category createdAt');
    
            // Format quiz data
            const availableQuizzes = quizzes.map(quiz => {
                return {
                    _id: quiz._id,
                    title: quiz.title,
                    description: quiz.description,
                    totalQuestions: quiz.totalQuestions,
                    timeDuration: quiz.timeDuration,
                    timeLimited: quiz.timeLimited,
                    category: quiz.category,
                    maxPossibleXP: quiz.totalQuestions * 25,
                    attempted: false, // Always false since we're filtering out attempted ones
                    score: null,
                    xpEarned: null
                };
            });
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Available unattempted quizzes retrieved successfully',
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

    async getQuizAttempt(req, res) {
        try {
          const hunterId = req.hunter.id;
          const { attemptId } = req.params;
          
          // Validate attempt ID format
          if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return res.status(400).json({
              status: 400,
              success: false,
              message: 'Invalid attempt ID format'
            });
          }
          
          // Find the quiz attempt, ensuring it belongs to this hunter
          const attempt = await QuizAttempt.findOne({
            _id: attemptId,
            hunter: hunterId
          }).populate('quiz', 'title description totalQuestions timeDuration category');
          
          if (!attempt) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'Quiz attempt not found or does not belong to you'
            });
          }
          
          // Format the response data
          const attemptData = {
            _id: attempt._id,
            quiz: {
              _id: attempt.quiz._id,
              title: attempt.quiz.title,
              description: attempt.quiz.description,
              totalQuestions: attempt.quiz.totalQuestions,
              timeDuration: attempt.quiz.timeDuration,
              category: attempt.quiz.category
            },
            startedAt: attempt.startedAt,
            completedAt: attempt.completedAt,
            answers: attempt.answers,
            score: attempt.score,
            xpEarned: attempt.xpEarned,
            status: attempt.completedAt ? 'completed' : 'in-progress',
            timeRemaining: attempt.quiz.timeDuration && !attempt.completedAt ? 
              Math.max(0, attempt.quiz.timeDuration - Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)) : 
              null
          };
          
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Quiz attempt retrieved successfully',
            data: attemptData
          });
        } catch (error) {
          console.error('Error in getQuizAttempt:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error retrieving quiz attempt',
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

            // Include questions with their complete information, including the new fields
            const questions = quiz.questions.map(question => {
                return {
                    _id: question._id,
                    questionText: question.questionText,
                    imageUrl: question.imageUrl,
                    radio: question.radio,       // Include the radio field
                    image: question.image,       // Include the image field
                    options: question.options,   // Include all option details including isCorrect
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
    
                // Handle skipped questions (empty strings or empty arrays)
                const normalizedSelectedOptionIds = Array.isArray(selectedOptionIds) 
                    ? selectedOptionIds.filter(id => id && id !== "") 
                    : [];
                
                // If normalizedSelectedOptionIds is empty, the question was skipped
                // or the user selected an empty answer
    
                // Check if answer is correct (only if not skipped)
                const correctOptionIds = question.options
                    .filter(opt => opt.isCorrect)
                    .map(opt => opt._id.toString());
    
                // Simple check - arrays must match exactly (for multiple correct answers)
                // Skip check if the question was skipped
                const isCorrect = 
                    normalizedSelectedOptionIds.length > 0 &&
                    normalizedSelectedOptionIds.length === correctOptionIds.length &&
                    normalizedSelectedOptionIds.every(id => correctOptionIds.includes(id));
    
                if (isCorrect) correctAnswers++;
    
                processedAnswers.push({
                    questionId,
                    selectedOptions: normalizedSelectedOptionIds,
                    isCorrect,
                    pointsEarned: isCorrect ? 25 : 0  // 25 points per correct answer
                });
            }
    
            // Handle missing questions
            // Create a set of all question IDs that were answered
            const answeredQuestionIds = new Set(answers.map(a => a.questionId.toString()));
            
            // Check for questions that weren't answered at all
            for (const question of quiz.questions) {
                if (!answeredQuestionIds.has(question._id.toString())) {
                    // Add skipped question to processed answers
                    processedAnswers.push({
                        questionId: question._id,
                        selectedOptions: [],
                        isCorrect: false,
                        pointsEarned: 0
                    });
                }
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
    
            // In the completeQuiz function, after calculating XP earned:
            await Hunter.findByIdAndUpdate(
                hunterId,
                {
                    $inc: {
                        'quizStats.totalQuizzes': 1,
                        'quizStats.totalXpEarned': attempt.xpEarned,
                        'quizStats.correctAnswers': correctAnswers,
                        'quizStats.totalQuestions': quiz.totalQuestions
                    }
                }
            );
    
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

}

module.exports = hunterQuizController;