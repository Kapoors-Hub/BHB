// const jwt = require('jsonwebtoken');

// const validateHunterToken = async (req, res, next) => {
//     try {
//         // Get token from header
//         const token = req.headers.authorization?.split(' ')[1];

//         if (!token) {
//             return res.status(401).json({
//                 status: 401,
//                 success: false,
//                 message: 'No token provided'
//             });
//         }

//         // Verify token
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);

//         // Check if it's a hunter token
//         if (decoded.role !== 'hunter') {
//             return res.status(403).json({
//                 status: 403,
//                 success: false,
//                 message: 'Not authorized as hunter'
//             });
//         }

//         // Check if the hunter is trying to update their own profile
//         if (decoded.id !== req.params.id) {
//             return res.status(403).json({
//                 status: 403,
//                 success: false,
//                 message: 'You can only update your own profile'
//             });
//         }

//         // Add hunter data to request
//         req.hunter = decoded;
//         next();

//     } catch (error) {
//         if (error.name === 'JsonWebTokenError') {
//             return res.status(401).json({
//                 status: 401,
//                 success: false,
//                 message: 'Invalid token'
//             });
//         }

//         if (error.name === 'TokenExpiredError') {
//             return res.status(401).json({
//                 status: 401,
//                 success: false,
//                 message: 'Token expired'
//             });
//         }

//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: 'Server error in token validation'
//         });
//     }
// };

// module.exports = {
//     validateHunterToken
// };

// middleware/auth.js

const jwt = require('jsonwebtoken');

const validateHunterToken = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'No token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if it's a hunter token
        if (decoded.role !== 'hunter') {
            return res.status(403).json({
                status: 403,
                success: false,
                message: 'Not authorized as hunter'
            });
        }

        // Add hunter data to request
        req.hunter = decoded;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Token expired'
            });
        }

        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Server error in token validation'
        });
    }
};

module.exports = {
        validateHunterToken
    };