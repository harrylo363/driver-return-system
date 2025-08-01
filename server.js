// server.js - Fixed version with no syntax errors
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting fixed server...');
console.log('📊 Port:', PORT);

// Basic middleware
app.use(express.json());

// Simple CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Demo data (in-memory)
let demoUsers = [
    { _id: 'user1', username: 'admin', email: 'admin@company.com', role: 'admin' },
    { _id: 'user2', username: 'John Smith', email: 'john@company.com', role: 'driver' },
    { _id: 'user3', username: 'Sarah Johnson', email: 'sarah@company.com', role: 'driver' },
    { _id: 'user4', username: 'Mike Davis', email: 'mike@company.com', role: 'driver' }
];

let demoNotifications = [];

// Root route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Driver Return System API - Fixed Version',
        status: 'online',
        timestamp: new Date().toISOString(),
        database: 'Demo mode (in-memory)',
        routes: {
            dashboard: '/dashboard',
            admin: '/admin',
            driver: '/driver',
            health: '/health'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        timestamp: new Date().toISOString()
    });
});

// Dashboard
app.get('/dashboard', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Driver Return System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">  
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    margin: 0; padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; color: white;
                }
                .container { max-width: 800px; margin: 0 auto; text-align: center; }
                .card {
                    background: rgba(255,255,255,0.95); color: #333;
                    padding: 40px; border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1); margin-bottom: 20px;
                }
                .btn {
                    display: inline-block; padding: 15px 30px; margin: 10px;
                    background: #667eea; color: white; text-decoration: none;
                    border-radius: 10px; font-weight: bold;
                }
                .status { 
                    background: #d4edda; color: #155724; 
                    padding: 10px; border-radius: 8px; margin: 10px 0; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🚚 Driver Return System</h1>
                    <div class="status">✅ System is Online (Fixed Version)</div>
                    <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
                    <div style="margin: 30px 0;">
                        <a href="/admin" class="btn">⚙️ Admin Panel</a>
                        <a href="/driver" class="btn">🚚 Driver App</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
    res.send(html);
});

// Auth endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if ((username === 'admin@company.com' || username === 'admin') && password === 'admin123!@#') {
        res.json({
            message: 'Login successful',
            token: 'demo-token',
            user: {
                id: 'user1',
                username: 'admin',
                email: 'admin@company.com',
                role: 'admin'
            }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get drivers
app.get('/api/auth/drivers', (req, res) => {
    const drivers = demoUsers.filter(user => user.role === 'driver');
    res.json(drivers);
});

// Get users
app.get('/api/users', (req, res) => {
    res.json(demoUsers);
});

// Create user
app.post('/api/users', (req, res) => {
    const { username, email, role } = req.body;
    
    const newUser = {
        _id: 'user_' + Date.now(),
        username,
        email: email || username + '@company.com',
        role
    };
    
    demoUsers.push(newUser);
    
    res.status(201).json({
        message: 'User created successfully',
        user: newUser
    });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    demoUsers = demoUsers.filter(user => user._id !== id);
    res.json({ message: 'User deleted successfully' });
});

// Notifications
app.post('/api/notifications/simple', (req, res) => {
    const notification = {
        ...req.body,
        _id: 'notif_' + Date.now(),
        timestamp: new Date().toISOString()
    };
    
    demoNotifications.unshift(notification);
    console.log(`📱 New notification from ${notification.driver}: ${notification.status}`);
    
    res.status(201).json({
        message: 'Notification sent successfully',
        notification
    });
});

app.get('/api/notifications', (req, res) => {
    res.json(demoNotifications);
});

// Admin panel
app.get('/admin', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Panel</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; color: #333;
                }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .card {
                    background: white; border-radius: 15px; padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1); margin-bottom: 20px;
                }
                .btn {
                    padding: 12px 24px; border: none; border-radius: 8px;
                    font-size: 16px; font-weight: bold; cursor: pointer;
                    margin: 5px; transition: all 0.3s;
                }
                .btn-primary { background: #667eea; color: white; }
                .btn-success { background: #28a745; color: white; }
                .message { padding: 15px; border-radius: 8px; margin: 15px 0; }
                .success { background: #d4edda; color: #155724; }
                .error { background: #f8d7da; color: #721c24; }
                input, select {
                    width: 100%; padding: 12px; border: 2px solid #e1e5e9;
                    border-radius: 8px; margin-bottom: 15px;
                }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>⚙️ Admin Panel</h1>
                    <div style="background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        ℹ️ Demo mode - changes work but don't persist between server restarts
                    </div>
                    
                    <div class="grid">
                        <div>
                            <h3>Login Test</h3>
                            <input type="text" id="username" value="admin@company.com">
                            <input type="password" id="password" value="admin123!@#">
                            <button class="btn btn-primary" onclick="testLogin()">Test Login</button>
                        </div>
                        <div>
                            <h3>Create User</h3>
                            <input type="text" id="newUsername" placeholder="Username">
                            <input type="text" id="newEmail" placeholder="Email">
                            <select id="newRole">
                                <option value="driver">Driver</option>
                                <option value="dispatcher">Dispatcher</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button class="btn btn-success" onclick="createUser()">Create User</button>
                        </div>
                    </div>
                    
                    <div id="message"></div>
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <button class="btn btn-primary" onclick="loadUsers()">Show All Users</button>
                        <a href="/driver" class="btn btn-primary">🚚 Test Driver App</a>
                        <a href="/dashboard" class="btn btn-primary">← Dashboard</a>
                    </div>
                    
                    <div id="usersList" style="margin-top: 20px;"></div>
                </div>
            </div>
            
            <script>
                async function testLogin() {
                    const username = document.getElementById('username').value;
                    const password = document.getElementById('password').value;
                    
                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            showMessage('✅ Login successful! Welcome ' + data.user.username, 'success');
                        } else {
                            showMessage('❌ ' + data.error, 'error');
                        }
                    } catch (error) {
                        showMessage('❌ Error: ' + error.message, 'error');
                    }
                }
                
                async function createUser() {
                    const username = document.getElementById('newUsername').value;
                    const email = document.getElementById('newEmail').value;
                    const role = document.getElementById('newRole').value;
                    
                    if (!username) {
                        showMessage('❌ Username required', 'error');
                        return;
                    }
                    
                    try {
                        const response = await fetch('/api/users', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, email, role })
                        });
                        
                        if (response.ok) {
                            showMessage('✅ User "' + username + '" created!', 'success');
                            document.getElementById('newUsername').value = '';
                            document.getElementById('newEmail').value = '';
                        }
                    } catch (error) {
                        showMessage('❌ Error: ' + error.message, 'error');
                    }
                }
                
                async function loadUsers() {
                    try {
                        const response = await fetch('/api/users');
                        const users = await response.json();
                        
                        let html = '<h3>Current Users:</h3>';
                        users.forEach(user => {
                            html += '<div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px;">';
                            html += '<strong>' + user.username + '</strong> (' + user.role + ') - ' + user.email;
                            html += '</div>';
                        });
                        
                        document.getElementById('usersList').innerHTML = html;
                    } catch (error) {
                        showMessage('❌ Error loading users: ' + error.message, 'error');
                    }
                }
                
                function showMessage(message, type) {
                    document.getElementById('message').innerHTML = 
                        '<div class="message ' + type + '">' + message + '</div>';
                }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// Driver app
app.get('/driver', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Driver App</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; color: #333;
                }
                .container { max-width: 400px; margin: 0 auto; padding: 20px; }
                .card {
                    background: white; border-radius: 20px; padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                .btn {
                    width: 100%; padding: 20px; border: none;
                    border-radius: 12px; font-size: 18px; font-weight: bold;
                    cursor: pointer; margin-bottom: 15px; color: white;
                }
                .btn-status { background: #ff6b6b; }
                .btn-arrived { background: #4caf50; }
                .message { 
                    padding: 15px; border-radius: 8px; margin: 15px 0; 
                    text-align: center; font-weight: bold;
                }
                .success { background: #d4edda; color: #155724; }
                .error { background: #f8d7da; color: #721c24; }
                select { 
                    width: 100%; padding: 15px; border: 2px solid #e1e5e9; 
                    border-radius: 12px; margin-bottom: 15px; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🚚 Driver App</h1>
                    
                    <div style="background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        ℹ️ Demo mode - notifications work and can be viewed in admin panel
                    </div>
                    
                    <select id="driverSelect">
                        <option value="">-- Select Your Name --</option>
                        <option value="John Smith">John Smith</option>
                        <option value="Sarah Johnson">Sarah Johnson</option>
                        <option value="Mike Davis">Mike Davis</option>
                    </select>
                    
                    <button class="btn btn-status" onclick="sendNotification('30 minutes away')">
                        🕐 30 MINUTES AWAY
                    </button>
                    
                    <button class="btn btn-status btn-arrived" onclick="sendNotification('arrived')">
                        ✅ ARRIVED AT WAREHOUSE
                    </button>
                    
                    <div id="message"></div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="/admin" style="color: #667eea; text-decoration: none;">⚙️ View in Admin Panel</a> | 
                        <a href="/dashboard" style="color: #667eea; text-decoration: none;">← Dashboard</a>
                    </div>
                </div>
            </div>
            
            <script>
                async function sendNotification(status) {
                    const driver = document.getElementById('driverSelect').value;
                    
                    if (!driver) {
                        showMessage('❌ Please select your name first', 'error');
                        return;
                    }
                    
                    try {
                        const response = await fetch('/api/notifications/simple', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                driver: driver,
                                status: status,
                                location: 'Demo Location',
                                estimatedArrival: status === 'arrived' ? 'At warehouse' : '30 min',
                                warehouse: 'Main Warehouse'
                            })
                        });
                        
                        if (response.ok) {
                            showMessage('✅ Status "' + status + '" sent successfully!', 'success');
                        } else {
                            showMessage('❌ Failed to send notification', 'error');
                        }
                    } catch (error) {
                        showMessage('❌ Error: ' + error.message, 'error');
                    }
                }
                
                function showMessage(message, type) {
                    document.getElementById('message').innerHTML = 
                        '<div class="message ' + type + '">' + message + '</div>';
                }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// Error handling
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
        error: 'Server error',
        message: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Page not found',
        path: req.originalUrl,
        availableRoutes: ['/', '/dashboard', '/admin', '/driver', '/health']
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fixed server running on port ${PORT}`);
    console.log(`📍 Routes: /, /dashboard, /admin, /driver, /health`);
    console.log(`✅ No syntax errors - server should be stable`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully');
    server.close(() => process.exit(0));
});

module.exports = app;
