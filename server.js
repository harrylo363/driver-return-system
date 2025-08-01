const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// ===== MONGODB CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/driver-return-system';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ===== MONGODB SCHEMAS =====
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['driver', 'dispatcher', 'admin'], default: 'driver' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
});

const notificationSchema = new mongoose.Schema({
    driver: { type: String, required: true },
    driverId: { type: String },
    status: { type: String, required: true },
    location: { type: String },
    estimatedArrival: { type: String },
    timestamp: { type: Date, default: Date.now },
    warehouse: { type: String, default: 'Main Warehouse' },
    company: { type: String, default: 'Your Company Inc.' }
});

const inspectionSchema = new mongoose.Schema({
    driver: { type: String, required: true },
    checkInTime: { type: Date, default: Date.now },
    tractorNumber: { type: String },
    trailerNumber: { type: String },
    status: { type: String, enum: ['good', 'issues', 'critical'], default: 'good' },
    damageFound: { type: String },
    mileage: { type: Number },
    location: { type: String }
});

// ===== MODELS =====
const User = mongoose.model('User', userSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Inspection = mongoose.model('Inspection', inspectionSchema);

// ===== HEALTH CHECK ROUTES =====
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Driver Return System',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        api: 'Working',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// ===== USER ROUTES =====

// Get all users or filter by role
app.get('/api/users', async (req, res) => {
    try {
        const { role } = req.query;
        const filter = role ? { role } : {};
        const users = await User.find(filter).select('-__v');
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user
app.post('/api/users', async (req, res) => {
    try {
        const { username, email, role = 'driver' } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const user = new User({
            username,
            email: email || `${username.toLowerCase().replace(/\s+/g, '.')}@company.com`,
            role
        });

        await user.save();
        res.status(201).json({ user, message: 'User created successfully' });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const user = await User.findByIdAndUpdate(id, updates, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user, message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ===== NOTIFICATION ROUTES =====

// Get drivers (for driver app dropdown)
app.get('/api/auth/drivers', async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver' }).select('username _id');
        res.json(drivers);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

// Driver notification (from driver app)
app.post('/api/notifications/driver-update', async (req, res) => {
    try {
        const notification = new Notification(req.body);
        await notification.save();
        
        // Log notification to console
        console.log('📤 New notification:', {
            driver: notification.driver,
            status: notification.status,
            time: notification.timestamp
        });
        
        res.status(201).json({ 
            message: 'Notification received successfully',
            notification 
        });
    } catch (error) {
        console.error('Error saving notification:', error);
        res.status(500).json({ error: 'Failed to save notification' });
    }
});

// Simple notification endpoint (backup)
app.post('/api/notifications/simple', async (req, res) => {
    try {
        const notification = new Notification(req.body);
        await notification.save();
        
        console.log('📤 Simple notification:', {
            driver: notification.driver,
            status: notification.status
        });
        
        res.json({ message: 'Notification saved', id: notification._id });
    } catch (error) {
        console.error('Error saving notification:', error);
        res.status(500).json({ error: 'Failed to save notification' });
    }
});

// Get all notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ timestamp: -1 })
            .limit(100);
        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// ===== INSPECTION ROUTES =====

// Get all inspections
app.get('/api/inspections', async (req, res) => {
    try {
        const inspections = await Inspection.find()
            .sort({ checkInTime: -1 })
            .limit(100);
        res.json({ reports: inspections });
    } catch (error) {
        console.error('Error fetching inspections:', error);
        res.status(500).json({ error: 'Failed to fetch inspections' });
    }
});

// Create inspection
app.post('/api/inspections', async (req, res) => {
    try {
        const inspection = new Inspection(req.body);
        await inspection.save();
        res.status(201).json({ inspection });
    } catch (error) {
        console.error('Error creating inspection:', error);
        res.status(500).json({ error: 'Failed to create inspection' });
    }
});

// ===== ADMIN AUTHENTICATION =====
app.post('/api/auth/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Simple demo authentication
        if (email === 'admin@company.com' && (password === 'admin123' || password === 'admin123!@#')) {
            res.json({ 
                token: 'demo-admin-token',
                user: { email, role: 'admin', username: 'Admin User' }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.get('/api/auth/verify', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token === 'demo-admin-token') {
        res.json({ valid: true, user: { role: 'admin' } });
    } else {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// ===== SERVE STATIC FILES =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/driver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// ===== INITIALIZE DEMO DATA =====
async function initializeDemoData() {
    try {
        // Check if users exist
        const userCount = await User.countDocuments();
        
        if (userCount === 0) {
            const demoUsers = [
                { username: 'admin', email: 'admin@company.com', role: 'admin' },
                { username: 'dispatcher1', email: 'dispatch@company.com', role: 'dispatcher' },
                { username: 'John Smith', email: 'john.smith@company.com', role: 'driver' },
                { username: 'Sarah Johnson', email: 'sarah.johnson@company.com', role: 'driver' },
                { username: 'Mike Davis', email: 'mike.davis@company.com', role: 'driver' },
                { username: 'Lisa Wilson', email: 'lisa.wilson@company.com', role: 'driver' }
            ];
            
            await User.insertMany(demoUsers);
            console.log('✅ Demo users created');
        }
        
        // Create some demo inspections
        const inspectionCount = await Inspection.countDocuments();
        if (inspectionCount === 0) {
            const demoInspections = [
                {
                    driver: 'John Smith',
                    tractorNumber: 'T-001',
                    trailerNumber: 'TR-105',
                    status: 'issues',
                    damageFound: 'Small scratch on trailer side panel',
                    mileage: 75000,
                    location: 'Main Depot'
                },
                {
                    driver: 'Sarah Johnson',
                    tractorNumber: 'T-003',
                    trailerNumber: 'TR-108',
                    status: 'good',
                    damageFound: '',
                    mileage: 82000,
                    location: 'North Terminal'
                },
                {
                    driver: 'Mike Davis',
                    tractorNumber: 'T-007',
                    trailerNumber: 'TR-201',
                    status: 'critical',
                    damageFound: 'Hydraulic leak detected, immediate attention required',
                    mileage: 91000,
                    location: 'South Hub'
                }
            ];
            
            await Inspection.insertMany(demoInspections);
            console.log('✅ Demo inspections created');
        }
        
    } catch (error) {
        console.error('Error initializing demo data:', error);
    }
}

// ===== START SERVER =====
app.listen(PORT, async () => {
    console.log(`🚀 Driver Return System running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 API available at: http://localhost:${PORT}/api/health`);
    
    // Initialize demo data
    if (mongoose.connection.readyState === 1) {
        await initializeDemoData();
    }
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});
