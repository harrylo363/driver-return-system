// server.js - Main application file
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/driver_return_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['driver', 'dispatcher', 'admin'], default: 'driver' },
    createdAt: { type: Date, default: Date.now }
});

// Notification Schema
const NotificationSchema = new mongoose.Schema({
    driver: { type: String, required: true },
    status: { type: String, required: true },
    location: { type: String },
    timestamp: { type: Date, default: Date.now },
    estimatedArrival: { type: String },
    warehouse: { type: String, required: true },
    company: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-room', (data) => {
        const { role } = data;
        if (role === 'dispatcher' || role === 'admin') {
            socket.join('dispatchers');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Register user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, role = 'driver' } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ username, email, password: hashedPassword, role });
        await user.save();

        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: user._id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send notification
app.post('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { status, location, estimatedArrival, warehouse, company } = req.body;

        const notification = new Notification({
            driver: req.user.username,
            status,
            location: location || 'Location unavailable',
            estimatedArrival: estimatedArrival || 'Unknown',
            warehouse,
            company
        });

        await notification.save();

        // Send real-time update to dispatchers
        io.to('dispatchers').emit('driver-notification', {
            driver: notification.driver,
            status: notification.status,
            location: notification.location,
            timestamp: notification.timestamp,
            estimatedArrival: notification.estimatedArrival
        });

        res.status(201).json({
            message: 'Notification sent successfully',
            notification: {
                id: notification._id,
                driver: notification.driver,
                status: notification.status,
                timestamp: notification.timestamp
            }
        });
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Get notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
    if (req.user.role !== 'dispatcher' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }

    Notification.find({})
        .sort({ timestamp: -1 })
        .limit(50)
        .then(notifications => {
            res.json({ notifications });
        })
        .catch(error => {
            console.error('Get notifications error:', error);
            res.status(500).json({ error: 'Failed to retrieve notifications' });
        });
});

// Initialize database with default users
async function initializeDatabase() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const defaultUsers = [
                {
                    username: 'admin',
                    email: 'admin@company.com',
                    password: await bcrypt.hash('admin123!@#', 12),
                    role: 'admin'
                },
                {
                    username: 'dispatcher1',
                    email: 'dispatcher@company.com',
                    password: await bcrypt.hash('dispatch123!@#', 12),
                    role: 'dispatcher'
                },
                {
                    username: 'driver1',
                    email: 'driver@company.com',
                    password: await bcrypt.hash('driver123!@#', 12),
                    role: 'driver'
                }
            ];

            await User.insertMany(defaultUsers);
            console.log('✅ Default users created');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
const PORT = process.env.PORT || 5000;
mongoose.connection.once('open', () => {
    console.log('✅ Connected to MongoDB');
    initializeDatabase();
    
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});

mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB connection error:', error);
});
