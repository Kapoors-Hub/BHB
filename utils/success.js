class Success {
    static created(message = 'Resource created successfully') {
      return {
        status: 201,
        success: true,
        message
      };
    }
  
    static ok(message = 'Request successful', data = null) {
      return {
        status: 200,
        success: true,
        message,
        data
      };
    }
  }
  
  module.exports = Success;