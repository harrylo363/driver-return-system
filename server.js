// server.js - Complete Fleet Management Backend
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// VAPID keys for push notifications
webpush.setVapidDetails(
  'mailto:admin@fleetforce.com',
  'BN3-pI2_z9rnLgHR2NowqM4yawWFlF-9wP2Gx8QzG9PnV1kdw0IkK3JWptNO8fn23bkb0O7Uo1d0cdlgVx-I4Ak',
  process.env.VAPID_PRIVATE_KEY || 'jiLvhykOZUbG7b5QmxV5WGhodqQN5db3fxP8dRKdJd0'
);

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Set JSON headers for API routes
app.use('/api/*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fleetmanagement';

console.log('🔄 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI)
.then(() => {
    console.log('✅ Connected to MongoDB');
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    // Don't exit, allow app to run with limited functionality
});

// Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, sparse: true },
    role: { 
        type: String, 
        required: true,
        enum: ['driver', 'dispatcher', 'admin'],
        default: 'driver'
    },
    active: { type: Boolean, default: true },
    vehicleId: String,
    phoneNumber: String,
    notifications: {
        enabled: { type: Boolean, default: false },
        subscription: mongoose.Schema.Types.Mixed
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    driver: { type: String, required: true },
    driverId: String,
    driverEmail: String,
    status: { 
        type: String, 
        required: true,
        enum: ['en-route', 'arrived', 'delayed', 'departed', 'pending-checkin']
    },
    location: String,
    warehouse: { type: String, default: '5856 Tampa FDC' },
    estimatedArrival: String,
    priority: { 
        type: String, 
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    checkedIn: { type: Boolean, default: false }
});

const checkInSchema = new mongoose.Schema({
    driverName: String,
    driverId: String,
    timestamp: { type: Date, default: Date.now },
    tractorNumber: String,
    trailerNumber: String,
    mileage: Number,
    fuelLevel: String,
    tractorIssue: String,
    trailerIssue: String,
    moffettIssue: String,
    equipmentIssues: {
        tractor: [String],
        trailer: [String],
        moffett: [String]
    },
    notes: String
});

// Models
const User = mongoose.model('User', userSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const CheckIn = mongoose.model('CheckIn', checkInSchema);

// Helper functions
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

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    sendResponse(res, {
        status: 'healthy',
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Users endpoints
app.get('/api/users', async (req, res) => {
    try {
        const { role, active } = req.query;
        const query = {};
        if (role) query.role = role;
        if (active !== undefined) query.active = active === 'true';
        
        const users = await User.find(query).select('-notifications.subscription').sort({ createdAt: -1 });
        sendResponse(res, users);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-notifications.subscription');
        if (!user) return sendError(res, new Error('User not found'), 404);
        sendResponse(res, user);
    } catch (error) {
        sendError(res, error);
    }
});

app.post('/api/users', async (req, res) => {
    try {
        // Validate required fields
        if (!req.body.name || !req.body.role) {
            return sendError(res, new Error('Name and role are required'), 400);
        }
        
        const userData = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const user = new User(userData);
        await user.save();
        
        const userResponse = user.toObject();
        delete userResponse.notifications?.subscription;
        
        sendResponse(res, userResponse, 'User created', 201);
    } catch (error) {
        sendError(res, error, 400);
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const updates = { ...req.body, updatedAt: new Date() };
        delete updates._id;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-notifications.subscription');
        
        if (!user) return sendError(res, new Error('User not found'), 404);
        sendResponse(res, user, 'User updated');
    } catch (error) {
        sendError(res, error);
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return sendError(res, new Error('User not found'), 404);
        sendResponse(res, { _id: req.params.id }, 'User deleted');
    } catch (error) {
        sendError(res, error);
    }
});

// Notifications endpoints
app.get('/api/notifications', async (req, res) => {
    try {
        const { status, driver, limit = 100 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (driver) query.driver = new RegExp(driver, 'i');
        
        const notifications = await Notification.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        sendResponse(res, notifications);
    } catch (error) {
        sendError(res, error);
    }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const notificationData = {
            ...req.body,
            timestamp: new Date()
        };
        
        const notification = new Notification(notificationData);
        await notification.save();
        
        // Try to send push notifications
        try {
            const admins = await User.find({
                role: { $in: ['admin', 'dispatcher'] },
                'notifications.enabled': true
            });
            
            for (const admin of admins) {
                if (admin.notifications?.subscription) {
                    try {
                        await webpush.sendNotification(
                            admin.notifications.subscription,
                            JSON.stringify({
                                title: `Driver Update: ${req.body.driver}`,
                                body: req.body.message,
                                icon: '/icon-192.png',
                                badge: '/icon-72.png',
                                data: {
                                    url: '/dashboard.html'
                                }
                            })
                        );
                    } catch (err) {
                        console.error('Push failed for', admin.name, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('Push notification error:', err);
        }
        
        sendResponse(res, notification, 'Notification created', 201);
    } catch (error) {
        sendError(res, error, 400);
    }
});

// Check-ins endpoints
app.get('/api/checkins', async (req, res) => {
    try {
        const checkins = await CheckIn.find()
            .sort({ timestamp: -1 })
            .limit(100);
        sendResponse(res, checkins);
    } catch (error) {
        sendError(res, error);
    }
});

app.post('/api/checkins', async (req, res) => {
    try {
        const checkin = new CheckIn(req.body);
        await checkin.save();
        sendResponse(res, checkin, 'Check-in created', 201);
    } catch (error) {
        sendError(res, error, 400);
    }
});

// Push notification subscription
app.post('/api/notifications/subscribe', async (req, res) => {
    try {
        const { userId, subscription } = req.body;
        
        if (!userId || !subscription) {
            return sendError(res, new Error('User ID and subscription are required'), 400);
        }
        
        const user = await User.findByIdAndUpdate(
            userId,
            {
                'notifications.enabled': true,
                'notifications.subscription': subscription,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!user) {
            return sendError(res, new Error('User not found'), 404);
        }
        
        sendResponse(res, { userId: user._id }, 'Subscription saved');
    } catch (error) {
        sendError(res, error);
    }
});

// Test notification
app.post('/api/notifications/test', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (userId) {
            const user = await User.findById(userId);
            if (user && user.notifications?.subscription) {
                await webpush.sendNotification(
                    user.notifications.subscription,
                    JSON.stringify({
                        title: 'Test Notification',
                        body: 'This is a test notification from FleetForce!',
                        icon: '/icon-192.png'
                    })
                );
            }
        }
        
        sendResponse(res, {}, 'Test notification sent');
    } catch (error) {
        sendError(res, error);
    }
});

// Serve HTML files for all other routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// Catch all other routes
app.get('*', (req, res) => {
    // Check if it's an API route that wasn't handled
    if (req.path.startsWith('/api/')) {
        return sendError(res, new Error('API endpoint not found'), 404);
    }
    // Otherwise serve the dashboard
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    sendError(res, err);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`👤 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`🚚 Driver: http://localhost:${PORT}/driver.html`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await mongoose.connection.close();
    process.exit(0);
});
