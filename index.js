const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for testing
let notifications = [];

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'healthy', 
    message: 'Driver Return System API is running',
    timestamp: new Date().toISOString(),
    notifications_count: notifications.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Driver Return System API - Simple Version',
    version: '1.0.0',
    endpoints: [
      'GET / - This page',
      'GET /api/health - Health check',
      'GET /api/notifications - Get all notifications',
      'POST /api/notifications - Create new notification'
    ],
    current_notifications: notifications.length
  });
});

// GET notifications for dispatcher
app.get('/api/notifications', (req, res) => {
  console.log(`GET /api/notifications - returning ${notifications.length} notifications`);
  
  res.json({ 
    notifications: notifications,
    count: notifications.length,
    timestamp: new Date().toISOString()
  });
});

// POST new notification from driver
app.post('/api/notifications', (req, res) => {
  console.log('POST /api/notifications received:', req.body);
  
  try {
    const { id, driver, status, location, timestamp, estimatedArrival } = req.body;
    
    // Validate required fields
    if (!driver || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields: driver, status' 
      });
    }
    
    // Create notification object
    const notification = {
      _id: id || Date.now().toString(),
      id: id || Date.now().toString(),
      driver: driver,
      status: status,
      location: location || 'Location not provided',
      timestamp: timestamp || new Date().toISOString(),
      estimatedArrival: estimatedArrival || 'Unknown',
      createdAt: new Date().toISOString()
    };
    
    // Add to in-memory storage
    notifications.unshift(notification);
    
    // Keep only last 50 notifications
    if (notifications.length > 50) {
      notifications = notifications.slice(0, 50);
    }
    
    console.log(`✅ Notification saved: ${driver} - ${status}`);
    
    res.json({ 
      success: true, 
      id: notification._id,
      message: 'Notification saved successfully',
      total_notifications: notifications.length
    });
    
  } catch (error) {
    console.error('❌ Error saving notification:', error);
    res.status(500).json({ 
      error: 'Failed to save notification',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚂 Railway API server running on port ${PORT}`);
  console.log(`📡 Ready to receive driver notifications!`);
});
