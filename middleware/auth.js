const jwt = require('jsonwebtoken');
const { ErrorHandler } = require('../utils/error');

const validateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw ErrorHandler.unauthorized('No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      throw ErrorHandler.unauthorized('Admin access required');
    }
    req.admin = decoded;
    next();
  } catch (error) {
    throw ErrorHandler.unauthorized('Invalid token');
  }
};

module.exports = { validateAdmin };