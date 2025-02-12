const successResponse = (res, message, data = null, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      message,
      data
    });
  };
  
  const errorResponse = (res, message, statusCode = 400, error = null) => {
    res.status(statusCode).json({
      success: false,
      message,
      error: error ? error.message : null
    });
  };
  
  module.exports = { successResponse, errorResponse };