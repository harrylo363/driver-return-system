const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize web-push only if we have the keys
let webpush = null;
const VAPID_PUBLIC_KEY = 'BN3-pI2_z9rnLgHR2NowqM4yawWFlF-9wP2Gx8QzG9PnV1kdw0IkK3JWptNO8fn23bkb0O7Uo1d0cdlgVx-I4Ak';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'jiLvhykOZUbG7b5QmxV5WGhodqQN5db3fxP8dRKdJd0';

// Try to setup web-push with error handling
try {
    webpush = require('web-push');
    webpush.setVapidDetails(
        'mailto:admin@fleetforce.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    console.log('✅ Push notifications initialized');
} catch (error) {
    console.warn('⚠️ Push notifications disabled:', error.message);
    console.log('Server will continue without push notification support');
}

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Set JSON headers for API routes
app.use('/api/*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection with fallback
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/fleetmanagement';

console.log('🚀 Starting Fleet Management Server...');
console.log('📦 Environment:', process.env.NODE_ENV || 'development');
console.log('🔔 Push Notifications:', webpush ? 'Enabled' : 'Disabled');

// MongoDB connection with error handling
let isConnected = false;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    isConnected = true;
})
.catch(err => {
    console.error('⚠️ MongoDB connection failed:', err.message);
    console.log('📌 Server running in offline mode - using demo data');
    isConnected = false;
});

// Monitor connection
mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('✅ MongoDB reconnected');
});

mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('⚠️ MongoDB disconnected');
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
    notes: String
});

// Models
let User, Notification, CheckIn;

try {
    User = mongoose.model('User', userSchema);
    Notification = mongoose.model('Notification', notificationSchema);
    CheckIn = mongoose.model('CheckIn', checkInSchema);
} catch (error) {
    console.log('Models already registered');
    User = mongoose.model('User');
    Notification = mongoose.model('Notification');
    CheckIn = mongoose.model('CheckIn');
}

// Demo data for offline mode
const demoUsers = [
    { _id: '1', name: 'John Driver', email: 'john@demo.com', role: 'driver', active: true, vehicleId: 'TRUCK-001' },
    { _id: '2', name: 'Jane Smith', email: 'jane@demo.com', role: 'driver', active: true, vehicleId: 'TRUCK-002' },
    { _id: '3', name: 'Bob Johnson', email: 'bob@demo.com', role: 'driver', active: true, vehicleId: 'TRUCK-003' },
    { _id: '4', name: 'Admin User', email: 'admin@demo.com', role: 'admin', active: true }
];

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
    console.error('API Error:', error.message);
    res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
};

// Push notification function with error handling
async function sendPushNotification(subscription, payload) {
    if (!webpush) {
        console.log('Push notifications not available');
        return false;
    }
    
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        console.log('✅ Push notification sent');
        return true;
    } catch (error) {
        console.error('Push notification failed:', error.message);
        if (error.statusCode === 410) {
            console.log('Subscription expired, removing...');
            // Could remove the subscription from database here
        }
        return false;
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    sendResponse(res, {
        status: 'healthy',
        database: isConnected ? 'connected' : 'disconnected (using demo mode)',
        pushNotifications: webpush ? 'enabled' : 'disabled',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Users endpoints with offline fallback
app.get('/api/users', async (req, res) => {
    try {
        if (!isConnected) {
            const { role } = req.query;
            let filtered = demoUsers;
            if (role) {
                filtered = demoUsers.filter(u => u.role === role);
            }
            return sendResponse(res, filtered, 'Demo data (offline mode)');
        }
        
        const { role, active } = req.query;
        const query = {};
        if (role) query.role = role;
        if (active !== undefined) query.active = active === 'true';
        
        const users = await User.find(query).select('-notifications.subscription').sort({ createdAt: -1 });
        sendResponse(res, users);
    } catch (error) {
        console.error('User fetch error:', error);
        sendResponse(res, demoUsers, 'Fallback to demo data');
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        if (!isConnected) {
            const user = demoUsers.find(u => u._id === req.params.id);
            if (!user) return sendError(res, new Error('User not found'), 404);
            return sendResponse(res, user, 'Demo data (offline mode)');
        }
        
        const user = await User.findById(req.params.id).select('-notifications.subscription');
        if (!user) return sendError(res, new Error('User not found'), 404);
        sendResponse(res, user);
    } catch (error) {
        const user = demoUsers.find(u => u._id === req.params.id);
        if (user) {
            sendResponse(res, user, 'Fallback to demo data');
        } else {
            sendError(res, error);
        }
    }
});

app.post('/api/users', async (req, res) => {
    try {
        if (!isConnected) {
            const newUser = {
                ...req.body,
                _id: Date.now().toString(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            demoUsers.push(newUser);
            return sendResponse(res, newUser, 'User created (demo mode)', 201);
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
        if (!isConnected) {
            const index = demoUsers.findIndex(u => u._id === req.params.id);
            if (index === -1) return sendError(res, new Error('User not found'), 404);
            
            demoUsers[index] = { ...demoUsers[index], ...req.body, updatedAt: new Date() };
            return sendResponse(res, demoUsers[index], 'User updated (demo mode)');
        }
        
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
        if (!isConnected) {
            const index = demoUsers.findIndex(u => u._id === req.params.id);
            if (index === -1) return sendError(res, new Error('User not found'), 404);
            
            demoUsers.splice(index, 1);
            return sendResponse(res, { _id: req.params.id }, 'User deleted (demo mode)');
        }
        
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
        if (!isConnected) {
            return sendResponse(res, [], 'No notifications (offline mode)');
        }
        
        const notifications = await Notification.find()
            .sort({ timestamp: -1 })
            .limit(100);
        
        sendResponse(res, notifications);
    } catch (error) {
        sendResponse(res, [], 'Fallback: empty notifications');
    }
});

app.post('/api/notifications', async (req, res) => {
    try {
        const notificationData = {
            ...req.body,
            timestamp: new Date()
        };
        
        let savedNotification;
        
        if (isConnected) {
            const notification = new Notification(notificationData);
            savedNotification = await notification.save();
        } else {
            savedNotification = {
                ...notificationData,
                _id: Date.now().toString()
            };
        }
        
        // Try to send push notifications if available
        if (webpush && isConnected) {
            try {
                const admins = await User.find({
                    role: { $in: ['admin', 'dispatcher'] },
                    'notifications.enabled': true
                });
                
                for (const admin of admins) {
                    if (admin.notifications?.subscription) {
                        await sendPushNotification(admin.notifications.subscription, {
                            title: `Driver Update: ${req.body.driver}`,
                            body: req.body.message,
                            icon: '/icon-192.png',
                            badge: '/icon-72.png',
                            data: {
                                url: '/dashboard.html'
                            }
                        });
                    }
                }
            } catch (pushError) {
                console.error('Push notification error:', pushError);
                // Don't fail the request if push fails
            }
        }
        
        sendResponse(res, savedNotification, 'Notification created', 201);
    } catch (error) {
        sendError(res, error, 400);
    }
});

// Check-ins endpoints
app.get('/api/checkins', async (req, res) => {
    try {
        if (!isConnected) {
            return sendResponse(res, [], 'No check-ins (offline mode)');
        }
        
        const checkins = await CheckIn.find()
            .sort({ timestamp: -1 })
            .limit(100);
        sendResponse(res, checkins);
    } catch (error) {
        sendResponse(res, [], 'Fallback: empty check-ins');
    }
});

app.post('/api/checkins', async (req, res) => {
    try {
        if (!isConnected) {
            return sendResponse(res, {
                ...req.body,
                _id: Date.now().toString(),
                timestamp: new Date()
            }, 'Check-in created (demo mode)', 201);
        }
        
        const checkin = new CheckIn(req.body);
        await checkin.save();
        sendResponse(res, checkin, 'Check-in created', 201);
    } catch (error) {
        sendError(res, error, 400);
    }
});

// Push notification subscription endpoint
app.post('/api/notifications/subscribe', async (req, res) => {
    try {
        if (!webpush) {
            return sendError(res, new Error('Push notifications not available on this server'), 501);
        }
        
        const { userId, subscription } = req.body;
        
        if (!userId || !subscription) {
            return sendError(res, new Error('User ID and subscription required'), 400);
        }
        
        if (!isConnected) {
            return sendResponse(res, { userId }, 'Subscription saved (demo mode)');
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
        
        // Send test notification
        await sendPushNotification(subscription, {
            title: 'Notifications Enabled',
            body: 'You will now receive fleet updates',
            icon: '/icon-192.png'
        });
        
        sendResponse(res, { userId: user._id }, 'Push notifications enabled');
    } catch (error) {
        sendError(res, error);
    }
});

// Test push notification
app.post('/api/notifications/test', async (req, res) => {
    try {
        if (!webpush) {
            return sendError(res, new Error('Push notifications not available'), 501);
        }
        
        const { userId } = req.body;
        
        if (!isConnected) {
            return sendResponse(res, {}, 'Test notification sent (demo mode)');
        }
        
        if (userId) {
            const user = await User.findById(userId);
            if (user?.notifications?.subscription) {
                await sendPushNotification(user.notifications.subscription, {
                    title: 'Test Notification',
                    body: 'This is a test from FleetForce!',
                    icon: '/icon-192.png'
                });
            }
        }
        
        sendResponse(res, {}, 'Test notification sent');
    } catch (error) {
        sendError(res, error);
    }
});

// Get VAPID public key
app.get('/api/notifications/vapid-key', (req, res) => {
    sendResponse(res, {
        publicKey: VAPID_PUBLIC_KEY,
        enabled: !!webpush
    });
});

// Serve HTML files
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

// Catch all
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return sendError(res, new Error('API endpoint not found'), 404);
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    sendError(res, err);
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║         Fleet Management System v2.0          ║
╠═══════════════════════════════════════════════╣
║  🚀 Server:     http://localhost:${PORT}         ║
║  📊 Dashboard:  http://localhost:${PORT}/dashboard.html ║
║  👤 Admin:      http://localhost:${PORT}/admin.html     ║
║  🚚 Driver:     http://localhost:${PORT}/driver.html    ║
║  💾 Database:   ${isConnected ? '✅ Connected' : '⚠️  Offline Mode'}              ║
║  🔔 Push:       ${webpush ? '✅ Enabled' : '❌ Disabled'}                 ║
╚═══════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
