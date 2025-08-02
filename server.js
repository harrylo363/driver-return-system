const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster.mongodb.net/driver-system?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// MongoDB Schemas
const notificationSchema = new mongoose.Schema({
  driver: String,
  status: String,
  location: String,
  timestamp: { type: Date, default: Date.now },
  estimatedArrival: String,
  warehouse: String
});

const inspectionSchema = new mongoose.Schema({
  driver: String,
  checkInTime: Date,
  tractorNumber: String,
  trailerNumber: String,
  moffettNumber: String,
  odometerReading: Number,
  fuelLevel: String,
  safetyChecks: [String],
  equipmentChecks: [String],
  damageFound: String,
  repairsNeeded: String,
  deliveryNotes: String,
  additionalComments: String,
  submittedAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);
const Inspection = mongoose.model('Inspection', inspectionSchema);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Driver Return System is running',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Save driver notification to MongoDB
app.post('/api/notifications/simple', async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    
    res.json({ 
      success: true, 
      message: 'Notification saved to database',
      notification: notification 
    });
  } catch (error) {
    console.error('Error saving notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving notification',
      error: error.message 
    });
  }
});

// Get notifications from MongoDB
app.get('/api/notifications/list', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({ 
      success: true,
      notifications: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching notifications',
      error: error.message 
    });
  }
});

// Get all notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(20);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.json([]);
  }
});

// Save inspection to MongoDB
app.post('/api/inspections', async (req, res) => {
  try {
    const inspection = new Inspection(req.body);
    await inspection.save();
    
    res.json({ 
      success: true, 
      message: 'Inspection saved to database',
      inspection: inspection 
    });
  } catch (error) {
    console.error('Error saving inspection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving inspection',
      error: error.message 
    });
  }
});

// Get inspections from MongoDB
app.get('/api/inspections', async (req, res) => {
  try {
    const inspections = await Inspection.find()
      .sort({ submittedAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      reports: inspections
    });
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inspections',
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
