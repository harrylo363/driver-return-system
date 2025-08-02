require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - IMPORTANT: This must be set before middleware to fix Railway deployment
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] // Update this with your actual domain
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // Prevent MongoDB injection attacks
app.use(compression()); // Compress responses

// Serve static files from root directory
app.use(express.static(__dirname));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  // Don't exit, let Railway restart if needed
});

// Monitor connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Import schemas
const notificationSchema = new mongoose.Schema({
  driver: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['en-route', 'arrived', 'delayed', 'completed'],
    default: 'en-route'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  estimatedArrival: String,
  warehouse: {
    type: String,
    required: [true, 'Warehouse is required'],
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  notes: String
}, { timestamps: true });

const inspectionSchema = new mongoose.Schema({
  driver: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  checkInTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  tractorNumber: { 
    type: String, 
    required: [true, 'Tractor number is required'],
    uppercase: true,
    trim: true
  },
  trailerNumber: { 
    type: String, 
    required: [true, 'Trailer number is required'],
    uppercase: true,
    trim: true
  },
  moffettNumber: {
    type: String,
    uppercase: true,
    trim: true
  },
  odometerReading: { 
    type: Number, 
    required: [true, 'Odometer reading is required'],
    min: [0, 'Odometer reading cannot be negative']
  },
  fuelLevel: {
    type: String,
    enum: ['empty', '1/4', '1/2', '3/4', 'full'],
    required: [true, 'Fuel level is required']
  },
  safetyChecks: [String],
  equipmentChecks: [String],
  damageFound: String,
  repairsNeeded: String,
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  deliveryNotes: String,
  additionalComments: String,
  submittedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'action-required', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

// Add indexes for better performance
notificationSchema.index({ driver: 1, timestamp: -1 });
notificationSchema.index({ warehouse: 1, timestamp: -1 });
inspectionSchema.index({ driver: 1, submittedAt: -1 });
inspectionSchema.index({ status: 1, submittedAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
const Inspection = mongoose.model('Inspection', inspectionSchema);

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Driver Return System API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/api/health',
      notifications: {
        list: 'GET /api/notifications',
        create: 'POST /api/notifications',
        getOne: 'GET /api/notifications/:id',
        markRead: 'PATCH /api/notifications/:id/read'
      },
      inspections: {
        list: 'GET /api/inspections',
        create: 'POST /api/inspections',
        getOne: 'GET /api/inspections/:id',
        updateStatus: 'PATCH /api/inspections/:id/status'
      },
      stats: 'GET /api/stats'
    }
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    // Test database connection
    if (dbStatus === 'Connected') {
      await mongoose.connection.db.admin().ping();
    }
    
    res.json({ 
      status: 'OK', 
      message: 'Driver Return System is healthy',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Service unhealthy',
      database: 'Error',
      error: error.message
    });
  }
});

// Get all notifications with filtering
app.get('/api/notifications', async (req, res, next) => {
  try {
    const { 
      driver, 
      warehouse, 
      status,
      priority,
      unreadOnly,
      page = 1, 
      limit = 20
    } = req.query;
    
    // Build query
    const query = {};
    if (driver) query.driver = new RegExp(driver, 'i');
    if (warehouse) query.warehouse = new RegExp(warehouse, 'i');
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (unreadOnly === 'true') query.isRead = false;
    
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Notification.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: notifications,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get notification by ID
app.get('/api/notifications/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
});

// Create notification (keeping both endpoints for compatibility)
app.post('/api/notifications', async (req, res, next) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Notification created successfully',
      data: notification 
    });
  } catch (error) {
    next(error);
  }
});

// Legacy endpoint (keep for compatibility)
app.post('/api/notifications/simple', async (req, res, next) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    
    res.json({ 
      success: true, 
      message: 'Notification saved to database',
      notification: notification 
    });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
});

// Legacy endpoint (keep for compatibility)
app.get('/api/notifications/list', async (req, res, next) => {
  try {
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    res.json({ 
      success: true,
      notifications: notifications
    });
  } catch (error) {
    next(error);
  }
});

// Get all inspections with filtering
app.get('/api/inspections', async (req, res, next) => {
  try {
    const { 
      driver, 
      status, 
      urgencyLevel,
      page = 1, 
      limit = 20
    } = req.query;
    
    const query = {};
    if (driver) query.driver = new RegExp(driver, 'i');
    if (status) query.status = status;
    if (urgencyLevel) query.urgencyLevel = urgencyLevel;
    
    const skip = (page - 1) * limit;
    
    const [inspections, total] = await Promise.all([
      Inspection.find(query)
        .sort({ submittedAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Inspection.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: inspections,
      reports: inspections, // For backward compatibility
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get inspection by ID
app.get('/api/inspections/:id', async (req, res, next) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    
    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }
    
    res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    next(error);
  }
});

// Create inspection
app.post('/api/inspections', async (req, res, next) => {
  try {
    // If urgencyLevel is in the request body, use it
    if (req.body.repairsNeeded && !req.body.urgencyLevel) {
      // Determine urgency based on repairs needed
      if (req.body.repairsNeeded.toLowerCase().includes('urgent') || 
          req.body.repairsNeeded.toLowerCase().includes('critical')) {
        req.body.urgencyLevel = 'high';
      }
    }
    
    const inspection = new Inspection(req.body);
    await inspection.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Inspection saved successfully',
      data: inspection,
      inspection: inspection // For backward compatibility
    });
  } catch (error) {
    next(error);
  }
});

// Update inspection status
app.patch('/api/inspections/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const inspection = await Inspection.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    
    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }
    
    res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    next(error);
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res, next) => {
  try {
    const [
      totalNotifications,
      unreadNotifications,
      totalInspections,
      pendingInspections,
      criticalIssues,
      recentNotifications,
      recentInspections
    ] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ isRead: false }),
      Inspection.countDocuments(),
      Inspection.countDocuments({ status: 'pending' }),
      Inspection.countDocuments({ urgencyLevel: { $in: ['high', 'critical'] } }),
      Notification.find().sort({ timestamp: -1 }).limit(5).lean(),
      Inspection.find().sort({ submittedAt: -1 }).limit(5).lean()
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalNotifications,
          unreadNotifications,
          totalInspections,
          pendingInspections,
          criticalIssues
        },
        recent: {
          notifications: recentNotifications,
          inspections: recentInspections
        },
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Apply error handler
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
