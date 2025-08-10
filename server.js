// server.js - Complete Fleet Management Backend for Railway + MongoDB Atlas
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas Connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required');
    console.error('Please set MONGODB_URI in Railway environment variables');
    process.exit(1);
}

console.log('🔄 Connecting to MongoDB Atlas...');

mongoose.connect(MONGODB_URI)
.then(() => {
    console.log('✅ Connected to MongoDB Atlas');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
});

// MongoDB Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    role: { 
        type: String, 
        required: true, 
        enum: ['driver', 'dispatcher', 'admin'],
        default: 'driver'
    },
    password: { type: String },
    active: { type: Boolean, default: true },
    vehicleId: { type: String },
    phoneNumber: { type: String },
    permissions: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    driver: { type: String, required: true },
    driverId: { type: String },
    driverEmail: { type: String },
    status: { 
        type: String, 
        required: true,
        enum: ['en-route', 'arrived', 'delayed', 'departed']
    },
    location: { type: String },
    warehouse: { type: String, default: '5856 Tampa FDC' },
    estimatedArrival: { type: String },
    priority: { 
        type: String, 
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    checkedIn: { type: Boolean, default: false },
    checkInData: {
        checkInTime: Date,
        vehicleInfo: {
            truckNumber: String,
            trailerNumber: String,
            mileage: Number,
            fuelLevel: String
        },
        equipmentCheck: {
            items: [{
                id: String,
                label: String,
                status: String,
                issue: String
            }],
            totalIssues: { type: Number, default: 0 }
        },
        additionalNotes: String
    }
});

const inspectionSchema = new mongoose.Schema({
    driver: { type: String, required: true },
    driverId: { type: String },
    tractorNumber: { type: String },
    trailerNumber: { type: String },
    fuelLevel: { type: String },
    mileage: { type: Number },
    equipmentCheck: {
        items: [{
            id: String,
            label: String,
            status: String,
            issue: String
        }],
        totalIssues: { type: Number, default: 0 }
    },
    urgencyLevel: { 
        type: String, 
        enum: ['low', 'medium', 'high'],
        default: 'low'
    },
    additionalNotes: { type: String },
    submittedAt: { type: Date, default: Date.now },
    checkInTime: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Inspection = mongoose.model('Inspection', inspectionSchema);

// Utility Functions
const handleAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const sendResponse = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

const sendError = (res, error, statusCode = 500) => {
    console.error('API Error:', error);
    res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
};

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    sendResponse(res, {
        status: 'operational',
        database: dbStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        mongoConnection: mongoose.connection.readyState,
        timestamp: new Date().toISOString()
    });
});

// USER MANAGEMENT ENDPOINTS

// Get all users or filter by role
app.get('/api/users', handleAsync(async (req, res) => {
    const { role, active } = req.query;
    const query = {};
    
    if (role) query.role = role;
    if (active !== undefined) query.active = active === 'true';
    
    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 });
    
    sendResponse(res, users, `Found ${users.length} users`);
}));

// Get single user
app.get('/api/users/:id', handleAsync(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
        return sendError(res, new Error('User not found'), 404);
    }
    
    sendResponse(res, user);
}));

// Create new user
app.post('/api/users', handleAsync(async (req, res) => {
    const { name, email, role, password, vehicleId, phoneNumber } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
        return sendError(res, new Error('Name is required'), 400);
    }
    
    if (role !== 'driver' && !email) {
        return sendError(res, new Error('Email is required for dispatchers and admins'), 400);
    }
    
    if (role !== 'driver' && !password) {
        return sendError(res, new Error('Password is required for dispatchers and admins'), 400);
    }
    
    // Check for duplicate email if provided
    if (email) {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return sendError(res, new Error('Email already exists'), 400);
        }
    }
    
    const userData = {
        name: name.trim(),
        role: role || 'driver',
        active: true,
        createdAt: new Date()
    };
    
    if (email) userData.email = email.toLowerCase().trim();
    if (password) userData.password = password;
    if (vehicleId) userData.vehicleId = vehicleId;
    if (phoneNumber) userData.phoneNumber = phoneNumber;
    
    const user = new User(userData);
    await user.save();
    
    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    sendResponse(res, userResponse, 'User created successfully', 201);
}));

// Bulk create users
app.post('/api/users/bulk', handleAsync(async (req, res) => {
    const { users } = req.body;
    
    if (!Array.isArray(users) || users.length === 0) {
        return sendError(res, new Error('Users array is required'), 400);
    }
    
    const created = [];
    const errors = [];
    
    for (let i = 0; i < users.length; i++) {
        try {
            const userData = users[i];
            
            if (!userData.name || !userData.name.trim()) {
                errors.push({ index: i, error: 'Name is required' });
                continue;
            }
            
            const userDoc = {
                name: userData.name.trim(),
                role: userData.role || 'driver',
                active: true,
                createdAt: new Date()
            };
            
            if (userData.email) userDoc.email = userData.email.toLowerCase().trim();
            if (userData.password) userDoc.password = userData.password;
            
            const user = new User(userDoc);
            await user.save();
            
            const userResponse = user.toObject();
            delete userResponse.password;
            created.push(userResponse);
            
        } catch (error) {
            errors.push({ index: i, error: error.message });
        }
    }
    
    sendResponse(res, { created, errors }, `Created ${created.length} users with ${errors.length} errors`);
}));

// Update user
app.put('/api/users/:id', handleAsync(async (req, res) => {
    const updates = req.body;
    delete updates._id;
    
    updates.updatedAt = new Date();
    
    const user = await User.findByIdAndUpdate(
        req.params.id, 
        updates, 
        { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
        return sendError(res, new Error('User not found'), 404);
    }
    
    sendResponse(res, user, 'User updated successfully');
}));

// Delete user
app.delete('/api/users/:id', handleAsync(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
        return sendError(res, new Error('User not found'), 404);
    }
    
    sendResponse(res, { _id: req.params.id }, 'User deleted successfully');
}));

// NOTIFICATION ENDPOINTS

// Get all notifications
app.get('/api/notifications', handleAsync(async (req, res) => {
    const { status, driver, limit = 100 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (driver) query.driver = new RegExp(driver, 'i');
    
    const notifications = await Notification.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit));
    
    sendResponse(res, notifications, `Found ${notifications.length} notifications`);
}));

// Create notification
app.post('/api/notifications', handleAsync(async (req, res) => {
    const notificationData = {
        ...req.body,
        timestamp: new Date()
    };
    
    if (!notificationData.message) {
        return sendError(res, new Error('Message is required'), 400);
    }
    
    if (!notificationData.driver) {
        return sendError(res, new Error('Driver is required'), 400);
    }
    
    if (!notificationData.status) {
        return sendError(res, new Error('Status is required'), 400);
    }
    
    const notification = new Notification(notificationData);
    await notification.save();
    
    sendResponse(res, notification, 'Notification created successfully', 201);
}));

// Update notification with check-in data
app.put('/api/notifications/:id/checkin', handleAsync(async (req, res) => {
    const checkInData = req.body;
    
    const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        {
            checkedIn: true,
            checkInData: checkInData,
            updatedAt: new Date()
        },
        { new: true }
    );
    
    if (!notification) {
        return sendError(res, new Error('Notification not found'), 404);
    }
    
    // Create inspection record
    const inspection = new Inspection({
        driver: notification.driver,
        driverId: notification.driverId,
        tractorNumber: checkInData.vehicleInfo?.truckNumber,
        trailerNumber: checkInData.vehicleInfo?.trailerNumber,
        fuelLevel: checkInData.vehicleInfo?.fuelLevel,
        mileage: checkInData.vehicleInfo?.mileage,
        equipmentCheck: checkInData.equipmentCheck,
        urgencyLevel: checkInData.equipmentCheck?.totalIssues > 0 ? 'high' : 'low',
        additionalNotes: checkInData.additionalNotes,
        submittedAt: new Date(),
        checkInTime: new Date(checkInData.checkInTime)
    });
    
    await inspection.save();
    
    sendResponse(res, { notification, inspection }, 'Check-in completed successfully');
}));

// Delete notification
app.delete('/api/notifications/:id', handleAsync(async (req, res) => {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
        return sendError(res, new Error('Notification not found'), 404);
    }
    
    sendResponse(res, { _id: req.params.id }, 'Notification deleted successfully');
}));

// INSPECTION ENDPOINTS

// Get all inspections
app.get('/api/inspections', handleAsync(async (req, res) => {
    const { driver, urgency, limit = 100 } = req.query;
    const query = {};
    
    if (driver) query.driver = new RegExp(driver, 'i');
    if (urgency) query.urgencyLevel = urgency;
    
    const inspections = await Inspection.find(query)
        .sort({ submittedAt: -1 })
        .limit(parseInt(limit));
    
    sendResponse(res, inspections, `Found ${inspections.length} inspections`);
}));

// Create inspection
app.post('/api/inspections', handleAsync(async (req, res) => {
    const inspection = new Inspection({
        ...req.body,
        submittedAt: new Date()
    });
    
    await inspection.save();
    
    sendResponse(res, inspection, 'Inspection created successfully', 201);
}));

// STATISTICS ENDPOINT
app.get('/api/stats', handleAsync(async (req, res) => {
    const [totalUsers, totalNotifications, totalInspections, activeDrivers] = await Promise.all([
        User.countDocuments(),
        Notification.countDocuments(),
        Inspection.countDocuments(),
        User.countDocuments({ role: 'driver', active: true })
    ]);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNotifications = await Notification.countDocuments({
        timestamp: { $gte: today }
    });
    
    const statusBreakdown = await Notification.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const stats = {
        overview: {
            totalUsers,
            totalNotifications,
            totalInspections,
            activeDrivers,
            todayActivity: todayNotifications
        },
        statusBreakdown: statusBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        lastUpdated: new Date().toISOString()
    };
    
    sendResponse(res, stats);
}));

// Route all other requests to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    sendError(res, error);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Fleet Management Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('📄 MongoDB connection closed');
        process.exit(0);
    });
});

module.exports = app;
