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

// IMPORTANT: Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/driver-returns');

// Notification Schema
const notificationSchema = new mongoose.Schema({
    message: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Serve index.html from public folder or a default page
app.get('/', (req, res) => {
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(publicIndexPath)) {
        res.sendFile(publicIndexPath);
    } else {
        // Fallback HTML if no index.html exists
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Driver Return System</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f0f2f5;
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 15px;
                        margin-bottom: 30px;
                        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    }
                    h1 { margin: 0; font-size: 2.5em; }
                    .status-badge {
                        display: inline-block;
                        background: #4CAF50;
                        padding: 8px 16px;
                        border-radius: 20px;
                        margin-top: 10px;
                        font-size: 0.9em;
                    }
                    .container {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .card {
                        background: white;
                        padding: 25px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    }
                    .endpoint {
                        background: #f8f9fa;
                        padding: 12px;
                        margin: 8px 0;
                        border-radius: 8px;
                        font-family: 'Courier New', monospace;
                        border-left: 4px solid #667eea;
                    }
                    .notifications-container {
                        background: white;
                        padding: 25px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        max-height: 500px;
                        overflow-y: auto;
                    }
                    .notification-item {
                        background: #f8f9fa;
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 8px;
                        border-left: 4px solid #764ba2;
                    }
                    .notification-item.read {
                        opacity: 0.6;
                        border-left-color: #ccc;
                    }
                    button {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: transform 0.2s;
                    }
                    button:hover {
                        transform: translateY(-2px);
                    }
                    pre {
                        background: #1e1e1e;
                        color: #fff;
                        padding: 15px;
                        border-radius: 8px;
                        overflow-x: auto;
                        font-size: 14px;
                    }
                    .loading {
                        text-align: center;
                        color: #666;
                        padding: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚗 Driver Return System</h1>
                    <div class="status-badge">✅ API Status: Online</div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <h2>📡 API Endpoints</h2>
                        <div class="endpoint">GET <a href="/api/notifications">/api/notifications</a></div>
                        <div class="endpoint">POST /api/notifications</div>
                        <div class="endpoint">PUT /api/notifications/:id/read</div>
                        <div class="endpoint">DELETE /api/notifications/:id</div>
                        <div class="endpoint">GET <a href="/health">/health</a></div>
                    </div>
                    
                    <div class="card">
                        <h2>🧪 Test Controls</h2>
                        <button onclick="createTestNotification()">Create Test Notification</button>
                        <br><br>
                        <button onclick="clearAllNotifications()" style="background: #f44336;">Clear All Notifications</button>
                    </div>
                </div>
                
                <div class="notifications-container">
                    <h2>📬 Live Notifications</h2>
                    <div id="notifications" class="loading">Loading notifications...</div>
                </div>
                
                <script>
                    let notifications = [];
                    
                    async function loadNotifications() {
                        try {
                            const response = await fetch('/api/notifications');
                            notifications = await response.json();
                            displayNotifications();
                        } catch (error) {
                            document.getElementById('notifications').innerHTML = 
                                '<p style="color: red;">Error: ' + error.message + '</p>';
                        }
                    }
                    
                    function displayNotifications() {
                        const container = document.getElementById('notifications');
                        
                        if (notifications.length === 0) {
                            container.innerHTML = '<p style="text-align: center; color: #666;">No notifications yet</p>';
                            return;
                        }
                        
                        container.innerHTML = notifications.map(notif => \`
                            <div class="notification-item \${notif.read ? 'read' : ''}">
                                <strong>\${notif.message}</strong><br>
                                <small>🕐 \${new Date(notif.timestamp).toLocaleString()}</small><br>
                                <small>Status: \${notif.read ? '✓ Read' : '● Unread'}</small>
                            </div>
                        \`).join('');
                    }
                    
                    async function createTestNotification() {
                        try {
                            const response = await fetch('/api/notifications', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    message: 'Test notification - ' + new Date().toLocaleString()
                                })
                            });
                            
                            if (response.ok) {
                                loadNotifications();
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }
                    
                    async function clearAllNotifications() {
                        if (confirm('Are you sure you want to delete all notifications?')) {
                            try {
                                const response = await fetch('/api/notifications', {
                                    method: 'DELETE'
                                });
                                
                                if (response.ok) {
                                    loadNotifications();
                                }
                            } catch (error) {
                                alert('Error: ' + error.message);
                            }
                        }
                    }
                    
                    // Load on start and refresh every 3 seconds
                    loadNotifications();
                    setInterval(loadNotifications, 3000);
                </script>
            </body>
            </html>
        `);
    }
});

// API Routes
app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ timestamp: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/notifications', async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
});
