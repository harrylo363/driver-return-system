// server.js - Complete server file with notifications support
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fleetforce';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// ============= SCHEMAS =============

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['driver', 'dispatcher', 'admin'],
    default: 'driver',
    required: true
  },
  vehicleId: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

// Notification Schema (for driver status updates)
const notificationSchema = new mongoose.Schema({
  driver: {
    type: String,
    required: true
  },
  driverId: {
    type: String
  },
  status: {
    type: String,
    enum: ['en-route', 'arrived', 'standby', 'pending-checkin'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  warehouse: {
    type: String,
    default: '5856 Tampa FDC'
  },
  location: {
    type: String
  },
  estimatedArrival: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

// Enhanced Check-in Schema (for detailed equipment inspections)
const checkInSchema = new mongoose.Schema({
  // Driver Information
  driverName: {
    type: String,
    required: true
  },
  driverId: String,
  
  // Tractor Inspection
  tractorNumber: String,
  tractorCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  tractorDamage: {
    type: String,
    enum: ['none', 'minor', 'major'],
    default: 'none'
  },
  tractorLights: {
    type: Boolean,
    default: true
  },
  tractorCab: {
    type: Boolean,
    default: true
  },
  tractorExtinguisher: {
    type: Boolean,
    default: true
  },
  tractorTires: {
    type: Boolean,
    default: true
  },
  tractorAirLeaks: {
    type: Boolean,
    default: false
  },
  tractorNotes: String,
  tractorIssues: {
    type: Boolean,
    default: false
  },
  
  // Trailer Inspection
  trailerNumber: String,
  trailerDeckCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  trailerTires: {
    type: Boolean,
    default: true
  },
  trailerElectrical: {
    type: Boolean,
    default: true
  },
  trailerClean: {
    type: Boolean,
    default: true
  },
  trailerDebris: {
    type: Boolean,
    default: false
  },
  trailerNotes: String,
  trailerIssues: {
    type: Boolean,
    default: false
  },
  
  // Moffett Inspection
  moffettNumber: String,
  moffettCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  moffettTires: {
    type: Boolean,
    default: true
  },
  moffettElectrical: {
    type: Boolean,
    default: true
  },
  moffettHydraulic: {
    type: Boolean,
    default: false
  },
  moffettSeatbelts: {
    type: Boolean,
    default: true
  },
  moffettNotes: String,
  moffettIssues: {
    type: Boolean,
    default: false
  },
  
  // Legacy fields for backward compatibility
  tractorIssue: {
    type: String,
    default: 'No issues'
  },
  trailerIssue: {
    type: String,
    default: 'No issues'
  },
  moffettIssue: {
    type: String,
    default: 'No issues'
  },
  
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const CheckIn = mongoose.model('CheckIn', checkInSchema);

// ============= API ROUTES =============

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
      status: 'ok',
      data: {
        database: dbStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============= USER ROUTES =============

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const userData = {
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      role: req.body.role || 'driver',
      vehicleId: req.body.vehicleId,
      active: req.body.active !== false,
      pushNotifications: req.body.pushNotifications !== false
    };

    const user = new User(userData);
    await user.save();
    
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update user
app.patch('/api/users/:id', async (req, res) => {
  try {
    const updates = {};
    
    const allowedUpdates = [
      'name', 'email', 'phoneNumber', 'role', 'vehicleId', 
      'active', 'pushNotifications'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully', user });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Bulk create users
app.post('/api/users/bulk', async (req, res) => {
  try {
    const users = req.body.users;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Users must be an array' });
    }
    
    const createdUsers = await User.insertMany(users, { 
      ordered: false
    });
    
    res.status(201).json({
      success: true,
      created: createdUsers.length,
      users: createdUsers
    });
  } catch (error) {
    console.error('Error bulk creating users:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============= NOTIFICATION ROUTES =============

// Get all notifications (for dashboard)
app.get('/api/notifications', async (req, res) => {
  try {
    // Get notifications from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const notifications = await Notification.find({
      timestamp: { $gte: oneDayAgo }
    }).sort({ timestamp: -1 }).limit(100);
    
    res.json({ data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Create notification (from driver portal)
app.post('/api/notifications', async (req, res) => {
  try {
    // Parse the incoming data
    let status = 'standby';
    let estimatedArrival = null;
    
    // Determine status from message or explicit status field
    if (req.body.status) {
      if (req.body.status.includes('30 min') || req.body.status === '30 minutes away') {
        status = 'en-route';
        estimatedArrival = '30 minutes';
      } else if (req.body.status.toLowerCase().includes('arrived')) {
        status = 'arrived';
      } else {
        status = req.body.status;
      }
    } else if (req.body.message) {
      if (req.body.message.includes('30 minutes')) {
        status = 'en-route';
        estimatedArrival = '30 minutes';
      } else if (req.body.message.includes('arrived')) {
        status = 'arrived';
      }
    }
    
    const notificationData = {
      driver: req.body.driver || req.body.driverName || 'Unknown Driver',
      driverId: req.body.driverId,
      status: status,
      message: req.body.message || `Driver is ${status}`,
      warehouse: req.body.warehouse || '5856 Tampa FDC',
      location: req.body.location || 'Location unavailable',
      estimatedArrival: estimatedArrival,
      timestamp: req.body.timestamp || new Date()
    };

    const notification = new Notification(notificationData);
    await notification.save();
    
    console.log('Notification saved:', notification);
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete old notifications (cleanup)
app.delete('/api/notifications/cleanup', async (req, res) => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      timestamp: { $lt: threeDaysAgo }
    });
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} old notifications` 
    });
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    res.status(500).json({ error: 'Failed to cleanup notifications' });
  }
});

// ============= CHECK-IN ROUTES (for equipment issues) =============

// Get all check-ins
app.get('/api/checkins', async (req, res) => {
  try {
    const checkIns = await CheckIn.find()
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({ data: checkIns });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Create detailed check-in with equipment inspection
app.post('/api/checkins', async (req, res) => {
  try {
    // Create comprehensive check-in data
    const checkInData = {
      // Driver info
      driverName: req.body.driverName,
      driverId: req.body.driverId,
      
      // Tractor inspection details
      tractorNumber: req.body.tractorNumber,
      tractorCondition: req.body.tractorCondition || 'good',
      tractorDamage: req.body.tractorDamage || 'none',
      tractorLights: req.body.tractorLights !== false,
      tractorCab: req.body.tractorCab !== false,
      tractorExtinguisher: req.body.tractorExtinguisher !== false,
      tractorTires: req.body.tractorTires !== false,
      tractorAirLeaks: req.body.tractorAirLeaks === true,
      tractorNotes: req.body.tractorNotes || '',
      tractorIssues: req.body.tractorIssues === true,
      
      // Trailer inspection details
      trailerNumber: req.body.trailerNumber,
      trailerDeckCondition: req.body.trailerDeckCondition || 'good',
      trailerTires: req.body.trailerTires !== false,
      trailerElectrical: req.body.trailerElectrical !== false,
      trailerClean: req.body.trailerClean !== false,
      trailerDebris: req.body.trailerDebris === true,
      trailerNotes: req.body.trailerNotes || '',
      trailerIssues: req.body.trailerIssues === true,
      
      // Moffett inspection details
      moffettNumber: req.body.moffettNumber,
      moffettCondition: req.body.moffettCondition || 'good',
      moffettTires: req.body.moffettTires !== false,
      moffettElectrical: req.body.moffettElectrical !== false,
      moffettHydraulic: req.body.moffettHydraulic === true,
      moffettSeatbelts: req.body.moffettSeatbelts !== false,
      moffettNotes: req.body.moffettNotes || '',
      moffettIssues: req.body.moffettIssues === true,
      
      // Legacy fields for backward compatibility
      tractorIssue: req.body.tractorIssues ? 'Issues reported' : 'No issues',
      trailerIssue: req.body.trailerIssues ? 'Issues reported' : 'No issues',
      moffettIssue: req.body.moffettIssues ? 'Issues reported' : 'No issues',
      
      timestamp: req.body.timestamp || new Date()
    };

    const checkIn = new CheckIn(checkInData);
    await checkIn.save();
    
    console.log('Check-in saved:', {
      driver: checkIn.driverName,
      tractor: checkIn.tractorIssues ? 'Has issues' : 'OK',
      trailer: checkIn.trailerIssues ? 'Has issues' : 'OK',
      moffett: checkIn.moffettIssues ? 'Has issues' : 'OK'
    });
    
    res.status(201).json({ success: true, data: checkIn });
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get check-ins with issues (for equipment monitoring)
app.get('/api/checkins/issues', async (req, res) => {
  try {
    const checkInsWithIssues = await CheckIn.find({
      $or: [
        { tractorIssues: true },
        { trailerIssues: true },
        { moffettIssues: true }
      ]
    }).sort({ timestamp: -1 }).limit(50);
    
    res.json({ data: checkInsWithIssues });
  } catch (error) {
    console.error('Error fetching check-ins with issues:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins with issues' });
  }
});

// ============= SERVE HTML FILES =============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/driver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`🚚 Driver Portal: http://localhost:${PORT}/driver.html`);
  console.log(`⚙️ Admin Panel: http://localhost:${PORT}/admin.html`);
});
