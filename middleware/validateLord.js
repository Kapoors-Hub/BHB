const jwt = require('jsonwebtoken');

const validateLordToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role !== 'lord') {
            return res.status(403).json({
                status: 403,
                success: false,
                message: 'Not authorized as lord'
            });
        }

        req.lord = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            status: 401,
            success: false,
            message: 'Invalid token'
        });
    }
};

module.exports = { validateLordToken };