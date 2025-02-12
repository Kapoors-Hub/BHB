class CustomError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = 'error';
    }
  }
  
  class ErrorHandler {
    static badRequest(message = 'Bad request') {
      return new CustomError(message, 400);
    }
  
    static unauthorized(message = 'Unauthorized access') {
      return new CustomError(message, 401);
    }
  
    static notFound(message = 'Resource not found') {
      return new CustomError(message, 404);
    }
  }
  
  module.exports = { CustomError, ErrorHandler };