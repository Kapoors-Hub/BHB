require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const adminRoutes = require('./routes/adminRoutes');
const hunterRoutes = require('./routes/hunterRoutes');

const app = express();
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/hunters', hunterRoutes);

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
app.listen(PORT ,() => {
  console.log(`Server running on port ${PORT}`);
});
