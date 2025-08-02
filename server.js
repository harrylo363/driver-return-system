const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable not set!');
  console.log('Using in-memory storage instead');
}

// Connect to MongoDB
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
    console.log('Database:', mongoose.connection.db.databaseName);
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Full error:', err);
  });

  // Log connection events
  mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
  });
}

// Rest of your schemas and routes...
// (Keep everything else the same)

// Add a test endpoint to verify database
app.get('/api/test-db', async (req, res) => {
  try {
    if (!mongoose.connection.readyState) {
      throw new Error('Database not connected');
    }
    
    // Try to count documents
    const notificationCount = await Notification.countDocuments();
    const inspectionCount = await Inspection.countDocuments();
    
    res.json({
      success: true,
      database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      databaseName: mongoose.connection.db?.databaseName || 'Unknown',
      collections: {
        notifications: notificationCount,
        inspections: inspectionCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
