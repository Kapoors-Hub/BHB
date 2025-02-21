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
const initializeWebSocket = require('./config/websocket');
const initCronJobs = require('./config/cronJobs');


const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Connect to MongoDB
connectDB();

// Initialize WebSocket
initializeWebSocket(server);
initCronJobs();

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/hunters', hunterRoutes);
app.use('/api/lords', lordRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
// 71362c2d-4cd1-4cf3-a0fc-e1ce078a70de
