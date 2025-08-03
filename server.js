const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve driver.html from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/driver-returns');

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['driver', 'dispatcher', 'admin'], required: true },
    password: { type: String }, // Only required for dispatchers and admins
    createdAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
    message: String,
    driver: String,
    status: String,
    location: String,
    warehouse: String,
    estimatedArrival: String,
    priority: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// USER MANAGEMENT ENDPOINTS

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get users by role
app.get('/api/users/role/:role', async (req, res) => {
    try {
        const users = await User.find({ role: req.params.role }).select('-password');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create single user
app.post('/api/users', async (req, res) => {
    try {
        const { name, email, role, password } = req.body;
        
        // Validate required fields
        if (!name || !email || !role) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, email, and role are required' 
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'User with this email already exists' 
            });
        }
        
        // Create user object
        const userData = { name, email, role };
        
        // Only require password for non-drivers
        if (role !== 'driver' && !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Password is required for dispatchers and admins' 
            });
        }
        
        if (password) {
            userData.password = password; // In production, hash this password
        }
        
        const user = new User(userData);
        await user.save();
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json({ success: true, data: userResponse });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Bulk create users
app.post('/api/users/bulk', async (req, res) => {
    try {
        const { users } = req.body;
        
        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please provide an array of users' 
            });
        }
        
        const results = {
            created: [],
            errors: []
        };
        
        for (const userData of users) {
            try {
                // Skip if user already exists
                const existingUser = await User.findOne({ email: userData.email });
                if (existingUser) {
                    results.errors.push({
                        email: userData.email,
                        error: 'User already exists'
                    });
                    continue;
                }
                
                // Create user
                const user = new User({
                    name: userData.name,
                    email: userData.email,
                    role: userData.role || 'driver',
                    password: userData.password
                });
                
                await user.save();
                results.created.push({
                    name: user.name,
                    email: user.email,
                    role: user.role
                });
            } catch (error) {
                results.errors.push({
                    email: userData.email,
                    error: error.message
                });
            }
        }
        
        res.json({ 
            success: true, 
            data: results,
            message: `Created ${results.created.length} users, ${results.errors.length} errors`
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { name, email, role, active } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role, active },
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Get drivers for driver portal dropdown
app.get('/api/drivers', async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver', active: true })
            .select('name')
            .sort('name');
        res.json({ success: true, data: drivers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// NOTIFICATION ENDPOINTS (existing)

// Get all notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ timestamp: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new notification
app.post('/api/notifications', async (req, res) => {
    try {
        const notification = new Notification({
            message: req.body.message || `${req.body.driver} - ${req.body.status}`,
            driver: req.body.driver,
            status: req.body.status,
            location: req.body.location,
            warehouse: req.body.warehouse,
            estimatedArrival: req.body.estimatedArrival,
            priority: req.body.priority
        });
        
        await notification.save();
        res.status(201).json({ 
            success: true, 
            data: notification 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { read: true },
            { new: true }
        );
        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete all notifications
app.delete('/api/notifications', async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
});
