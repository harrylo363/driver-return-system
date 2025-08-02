// app.js or index.js - Main Railway backend file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Notification Schema for MongoDB
const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  driver: { type: String, required: true },
  status: { type: String, required: true },
  location: { type: String, required: true },
  timestamp: { type: Date, required: true },
  estimatedArrival: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// ✅ Health check endpoint (already working)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Driver Return System API is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 🆕 Driver notification endpoint - POST
app.post('/api/notifications', async (req, res) => {
  try {
    console.log('📥 Received driver notification:', req.body);
    
    const { id, driver, status, location, timestamp, estimatedArrival } = req.body;
    
    // Validate required fields
    if (!id || !driver || !status || !location || !timestamp) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, driver, status, location, timestamp' 
      });
    }
    
    // Create new notification
    const notification = new Notification({
      id,
      driver,
      status,
      location,
      timestamp: new Date(timestamp),
      estimatedArrival: estimatedArrival || 'Unknown'
    });
    
    // Save to MongoDB Atlas
    const savedNotification = await notification.save();
    console.log('✅ Notification saved to MongoDB:', savedNotification._id);
    
    res.json({ 
      success: true, 
      id: savedNotification._id,
      message: 'Notification saved to MongoDB Atlas'
    });
    
  } catch (error) {
    console.error('❌ Error saving notification:', error);
    res.status(500).json({ 
      error: 'Failed to save notification',
      details: error.message 
    });
  }
});

// 🆕 Get notifications for dispatcher - GET
app.get('/api/notifications', async (req, res) => {
  try {
    console.log('📤 Fetching notifications for dispatcher');
    
    // Get recent notifications (last 50)
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    console.log(`✅ Found ${notifications.length} notifications`);
    
    res.json({ 
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      details: error.message 
    });
  }
});

// 🆕 Alternative driver endpoint
app.post('/api/driver/notification', async (req, res) => {
  // Use the same logic as /api/notifications
  try {
    const { id, driver, status, location, timestamp, estimatedArrival } = req.body;
    
    const notification = new Notification({
      id,
      driver,
      status,
      location,
      timestamp: new Date(timestamp),
      estimatedArrival: estimatedArrival || 'Unknown'
    });
    
    const savedNotification = await notification.save();
    
    res.json({ 
      success: true, 
      id: savedNotification._id,
      message: 'Driver notification received'
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to process driver notification',
      details: error.message 
    });
  }
});

// 🆕 Simple ping endpoint
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'API is responsive'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Driver Return System API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/notifications - Get all notifications',
      'POST /api/notifications - Create new notification',
      'POST /api/driver/notification - Alternative driver endpoint',
      'GET /api/ping - Simple ping test'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚂 Railway API server running on port ${PORT}`);
  console.log(`🍃 MongoDB connection: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
});

module.exports = app;
