const { ErrorHandler } = require('../utils/error');

const validateHunterRegistration = (req, res, next) => {
  const {
    name,
    collegeName,
    collegeEmail,
    mobileNumber,
    discipline,
    graduatingYear,
    dateOfBirth,
    postalZipCode,
    city,
    state,
    questions
  } = req.body;

  if (!name || !collegeName || !collegeEmail || !mobileNumber || !discipline ||
      !graduatingYear || !dateOfBirth || !postalZipCode || !city || !state) {
    throw ErrorHandler.badRequest('All fields are required');
  }

  if (!collegeEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw ErrorHandler.badRequest('Invalid email format');
  }

  if (!mobileNumber.match(/^\d{10}$/)) {
    throw ErrorHandler.badRequest('Invalid mobile number format');
  }
   if (!Array.isArray(questions) || questions.length === 0) {
    throw ErrorHandler.badRequest('Questions are required');
  }

  questions.forEach((item, index) => {
    if (!item.question || !item.answer) {
      throw ErrorHandler.badRequest(`Question ${index + 1} must have both question and answer`);
    }
  });

  next();
};

module.exports = { validateHunterRegistration };