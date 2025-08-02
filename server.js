const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection (updated to remove deprecated options)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/driver-returns');

// Notification Schema
const notificationSchema = new mongoose.Schema({
    message: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Debug route to check file structure
app.get('/debug/files', (req, res) => {
    const files = fs.readdirSync(__dirname);
    res.json({
        currentDirectory: __dirname,
        files: files,
        hasIndexHtml: files.includes('index.html')
    });
});

// Serve a simple HTML page if index.html doesn't exist
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Serve a basic HTML page that shows the API is working
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Driver Return System API</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 { color: #333; }
                    .status { 
                        background: #4CAF50; 
                        color: white; 
                        padding: 10px 20px; 
                        border-radius: 5px; 
                        display: inline-block;
                        margin: 20px 0;
                    }
                    .endpoint {
                        background: #f0f0f0;
                        padding: 10px;
                        margin: 10px 0;
                        border-radius: 5px;
                        font-family: monospace;
                    }
                    a { color: #2196F3; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    .data-section {
                        margin-top: 30px;
                        padding: 20px;
                        background: #f9f9f9;
                        border-radius: 5px;
                    }
                    pre {
                        background: #333;
                        color: #fff;
                        padding: 15px;
                        border-radius: 5px;
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚗 Driver Return System API</h1>
                    <div class="status">✅ API is Running!</div>
                    
                    <h2>Available Endpoints:</h2>
                    <div class="endpoint">GET <a href="/api/notifications">/api/notifications</a> - View all notifications</div>
                    <div class="endpoint">POST /api/notifications - Create new notification</div>
                    <div class="endpoint">PUT /api/notifications/:id/read - Mark as read</div>
                    <div class="endpoint">DELETE /api/notifications/:id - Delete notification</div>
                    <div class="endpoint">GET <a href="/health">/health</a> - Health check</div>
                    
                    <div class="data-section">
                        <h2>Current Notifications:</h2>
                        <div id="notifications">Loading...</div>
                    </div>
                    
                    <h2>Test the API:</h2>
                    <button onclick="createTestNotification()">Create Test Notification</button>
                    
                    <script>
                        // Load notifications
                        async function loadNotifications() {
                            try {
                                const response = await fetch('/api/notifications');
                                const data = await response.json();
                                document.getElementById('notifications').innerHTML = 
                                    '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                            } catch (error) {
                                document.getElementById('notifications').innerHTML = 
                                    '<p style="color: red;">Error loading notifications: ' + error.message + '</p>';
                            }
                        }
                        
                        // Create test notification
                        async function createTestNotification() {
                            try {
                                const response = await fetch('/api/notifications', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        message: 'Test notification created at ' + new Date().toLocaleString()
                                    })
                                });
                                
                                if (response.ok) {
                                    alert('Test notification created!');
                                    loadNotifications();
                                } else {
                                    alert('Error creating notification');
                                }
                            } catch (error) {
                                alert('Error: ' + error.message);
                            }
                        }
                        
                        // Load notifications on page load
                        loadNotifications();
                        
                        // Refresh every 5 seconds
                        setInterval(loadNotifications, 5000);
                    </script>
                </div>
            </body>
            </html>
        `);
    }
});

// API Routes

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
            message: req.body.message
        });
        await notification.save();
        res.status(201).json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
        res.json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete all notifications
app.delete('/api/notifications', async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling for undefined routes
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        availableRoutes: [
            'GET /',
            'GET /api/notifications',
            'POST /api/notifications',
            'PUT /api/notifications/:id/read',
            'DELETE /api/notifications/:id',
            'GET /health',
            'GET /debug/files'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Current directory: ${__dirname}`);
    console.log(`Files in directory: ${fs.readdirSync(__dirname).join(', ')}`);
});
