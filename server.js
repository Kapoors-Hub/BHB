// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const connectDB = require('./config/database');
const adminRoutes = require('./routes/adminRoutes');
const hunterRoutes = require('./routes/hunterRoutes');
const lordRoutes = require('./routes/lordRoutes');
const publicRoutes = require('./routes/publicRoutes');
const initializeWebSocket = require('./config/websocket');
const initCronJobs = require('./config/cronJobs');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥');
  console.error(error.name, error.message);
  console.error(error.stack);
  // Keep the server running despite the error
  console.log('Server has recovered from an uncaught exception and is still running');
});


process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error(error.name, error.message);
  console.error(error.stack);
  // Keep the server running despite the error
  console.log('Server has recovered from an unhandled rejection and is still running');
});

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request body size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/files', express.static('files'));

// Request timeout handler
app.use((req, res, next) => {
  // Set timeout for all requests
  req.setTimeout(30000, () => {
    console.error('Request has timed out.');
    res.status(503).json({
      status: 'error',
      statusCode: 503,
      message: 'Request timeout - server is busy processing your request'
    });
  });
  next();
});

// Connect to MongoDB with retry and recovery messaging
const connectWithRetry = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('Retrying in 5 seconds...');
    setTimeout(() => {
      console.log('Attempting to reconnect to MongoDB...');
      connectWithRetry();
    }, 5000);
  }
};

connectWithRetry();

// Initialize WebSocket safely
// try {
//   initializeWebSocket(server);
//   console.log('WebSocket server initialized');
// } catch (error) {
//   console.error('Error initializing WebSocket server:', error);
// }

// Initialize cron jobs safely
try {
  initCronJobs();
  console.log('Cron jobs initialized');
} catch (error) {
  console.error('Error initializing cron jobs:', error);
}

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/hunters', hunterRoutes);
app.use('/api/lords', lordRoutes);
app.use('/api/public', publicRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Validation Error',
      details: messages
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Invalid token. Please log in again!'
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Enhanced server error handling with recovery messaging
server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    setTimeout(() => {
      console.log(`Attempting to listen on port ${PORT} again...`);
      server.close();
      server.listen(PORT, () => {
        console.log(`Server recovered and is now running on port ${PORT}`);
      });
    }, 1000);
  } else {
    console.log('Server has recovered from an error and will continue running');
  }
});

module.exports = app;


// #/bin/bash
// rm /var/www/hunter -r
// mv dist /var/www/hunter
// systemctl restart nginx.service
