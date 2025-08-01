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

// Admin panel - Fixed version with proper functionality
app.get('/admin', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Panel - Driver Return System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; color: #333;
                }
                .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; color: white; margin-bottom: 30px; }
                .card {
                    background: white; border-radius: 15px; padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1); margin-bottom: 20px;
                }
                .hidden { display: none; }
                .btn {
                    padding: 12px 24px; border: none; border-radius: 8px;
                    font-size: 16px; font-weight: bold; cursor: pointer;
                    margin: 5px; transition: all 0.3s;
                }
                .btn:hover { transform: translateY(-2px); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-info { background: #17a2b8; color: white; }
                .btn-danger { background: #dc3545; color: white; }
                .message { padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: bold; }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
                input, select {
                    width: 100%; padding: 12px; border: 2px solid #e1e5e9;
                    border-radius: 8px; margin-bottom: 15px; font-size: 16px;
                }
                input:focus, select:focus { outline: none; border-color: #667eea; }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .tab-navigation {
                    display: flex; gap: 10px; margin-bottom: 30px;
                    justify-content: center; flex-wrap: wrap;
                }
                .tab-btn {
                    padding: 12px 24px; border: 2px solid #667eea; background: white;
                    color: #667eea; border-radius: 8px; cursor: pointer;
                    font-size: 16px; font-weight: 600; transition: all 0.3s;
                }
                .tab-btn:hover { background: #f8f9fa; }
                .tab-btn.active { background: #667eea; color: white; }
                .users-list, .notifications-list {
                    background: #f8f9fa; padding: 20px; border-radius: 8px;
                    margin-top: 20px; max-height: 400px; overflow-y: auto;
                }
                .user-item, .notification-item {
                    background: white; padding: 15px; border-radius: 8px;
                    margin-bottom: 10px; border-left: 4px solid #667eea;
                    display: flex; justify-content: space-between; align-items: center;
                    flex-wrap: wrap; gap: 10px;
                }
                .user-item.admin { border-left-color: #dc3545; }
                .user-item.dispatcher { border-left-color: #ffc107; }
                .user-item.driver { border-left-color: #28a745; }
                .notification-item { border-left-color: #17a2b8; }
                @media (max-width: 768px) { 
                    .grid { grid-template-columns: 1fr; }
                    .container { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚙️ Admin Panel</h1>
                    <p>Driver Return System Management</p>
                </div>

                <!-- Login Screen -->
                <div class="card" id="loginCard">
                    <h2>Admin Login</h2>
                    <div class="info message">
                        Demo Mode: Use <strong>admin@company.com</strong> / <strong>admin123!@#</strong>
                    </div>
                    <div class="form-group">
                        <label for="adminEmail">Email</label>
                        <input type="text" id="adminEmail" placeholder="admin@company.com" value="admin@company.com">
                    </div>
                    <div class="form-group">
                        <label for="adminPassword">Password</label>
                        <input type="password" id="adminPassword" placeholder="admin123!@#" value="admin123!@#">
                    </div>
                    <button class="btn btn-primary" onclick="adminLogin()">Login as Admin</button>
                    <div id="loginMessage"></div>
                </div>

                <!-- Main Admin Panel -->
                <div class="card hidden" id="mainAdminPanel">
                    <div class="tab-navigation">
                        <button class="tab-btn active" onclick="showTab('users', this)">👥 User Management</button>
                        <button class="tab-btn" onclick="showTab('notifications', this)">📱 Driver Notifications</button>
                    </div>

                    <!-- User Management Tab -->
                    <div id="usersTab" class="tab-content">
                        <h2>User Management</h2>
                        
                        <div class="success message">
                            ✅ Connected to database. Users created here will appear in the driver app!
                        </div>

                        <div class="grid">
                            <div>
                                <h3>Create New User</h3>
                                <div class="form-group">
                                    <label for="newUsername">Username</label>
                                    <input type="text" id="newUsername" placeholder="Enter full name">
                                </div>
                                <div class="form-group">
                                    <label for="newEmail">Email</label>
                                    <input type="email" id="newEmail" placeholder="user@company.com">
                                </div>
                                <div class="form-group">
                                    <label for="newPassword">Password</label>
                                    <input type="text" id="newPassword" placeholder="Enter password" value="password123">
                                </div>
                                <div class="form-group">
                                    <label for="newRole">Role</label>
                                    <select id="newRole">
                                        <option value="driver">Driver</option>
                                        <option value="dispatcher">Dispatcher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <button class="btn btn-success" onclick="createUser()">✅ Create User</button>
                            </div>
                            
                            <div>
                                <h3>Quick Actions</h3>
                                <button class="btn btn-info" onclick="loadUsers()" style="width: 100%;">🔄 Refresh User List</button>
                                <button class="btn btn-info" onclick="loadNotifications()" style="width: 100%;">📱 Load Notifications</button>
                                <button class="btn btn-primary" onclick="testDriverApp()" style="width: 100%;">🚚 Test Driver App</button>
                                
                                <div style="margin-top: 20px;">
                                    <h4>System Status</h4>
                                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; color: #155724;">
                                        <div>✅ Server Online</div>
                                        <div>✅ API Working</div>
                                        <div>✅ Demo Database Active</div>
                                        <div id="userCount">👥 Users: Loading...</div>
                                        <div id="notificationCount">📱 Notifications: Loading...</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="userMessage"></div>

                        <div class="users-list">
                            <h3>Current Users</h3>
                            <div id="usersList">
                                <div style="text-align: center; padding: 20px; color: #666;">
                                    Click "Refresh User List" to load users
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Notifications Tab -->
                    <div id="notificationsTab" class="tab-content hidden">
                        <h2>📱 Driver Notifications</h2>
                        
                        <div style="text-align: center; margin-bottom: 20px;">
                            <button class="btn btn-info" onclick="loadNotifications()">🔄 Refresh Notifications</button>
                            <button class="btn btn-success" onclick="clearNotifications()">🗑️ Clear All Notifications</button>
                        </div>

                        <div class="notifications-list">
                            <h3>Recent Driver Notifications</h3>
                            <div id="notificationsList">
                                <div style="text-align: center; padding: 20px; color: #666;">
                                    Click "Refresh Notifications" to load recent driver notifications
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                let authToken = null;
                let currentUsers = [];
                let currentNotifications = [];

                // Admin login
                async function adminLogin() {
                    const email = document.getElementById('adminEmail').value.trim();
                    const password = document.getElementById('adminPassword').value.trim();

                    if (!email || !password) {
                        showMessage('loginMessage', 'Email and password required', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: email, password })
                        });

                        const data = await response.json();

                        if (response.ok) {
                            authToken = data.token;
                            document.getElementById('loginCard').style.display = 'none';
                            document.getElementById('mainAdminPanel').classList.remove('hidden');
                            showMessage('userMessage', 'Welcome, ' + data.user.username + '! 🎉', 'success');
                            
                            // Auto-load data
                            loadUsers();
                            loadNotifications();
                        } else {
                            showMessage('loginMessage', data.error || 'Login failed', 'error');
                        }
                    } catch (error) {
                        console.error('Login error:', error);
                        showMessage('loginMessage', 'Login failed: ' + error.message, 'error');
                    }
                }

                // Tab navigation
                function showTab(tabName, buttonElement) {
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(tab => {
                        tab.classList.add('hidden');
                    });
                    
                    // Remove active class from all buttons
                    document.querySelectorAll('.tab-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Show selected tab and activate button
                    document.getElementById(tabName + 'Tab').classList.remove('hidden');
                    buttonElement.classList.add('active');
                    
                    // Load data when switching tabs
                    if (tabName === 'notifications') {
                        loadNotifications();
                    }
                }

                // Create user
                async function createUser() {
                    const username = document.getElementById('newUsername').value.trim();
                    const email = document.getElementById('newEmail').value.trim();
                    const password = document.getElementById('newPassword').value.trim();
                    const role = document.getElementById('newRole').value;

                    if (!username) {
                        showMessage('userMessage', '❌ Username is required', 'error');
                        return;
                    }

                    if (!password) {
                        showMessage('userMessage', '❌ Password is required', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/users', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                username, 
                                email: email || username.toLowerCase().replace(/\\s+/g, '') + '@company.com', 
                                password, 
                                role 
                            })
                        });

                        const data = await response.json();

                        if (response.ok) {
                            showMessage('userMessage', '✅ ' + role.toUpperCase() + ' "' + username + '" created successfully!', 'success');
                            
                            // Clear form
                            document.getElementById('newUsername').value = '';
                            document.getElementById('newEmail').value = '';
                            document.getElementById('newPassword').value = 'password123';
                            
                            // Reload users
                            loadUsers();
                        } else {
                            showMessage('userMessage', '❌ ' + (data.error || 'Failed to create user'), 'error');
                        }
                    } catch (error) {
                        console.error('Create user error:', error);
                        showMessage('userMessage', '❌ Error: ' + error.message, 'error');
                    }
                }

                // Load users
                async function loadUsers() {
                    try {
                        const response = await fetch('/api/users');
                        
                        if (response.ok) {
                            currentUsers = await response.json();
                            displayUsers(currentUsers);
                            updateUserCount();
                            showMessage('userMessage', '✅ Loaded ' + currentUsers.length + ' users', 'success');
                        } else {
                            showMessage('userMessage', '❌ Failed to load users', 'error');
                        }
                    } catch (error) {
                        console.error('Load users error:', error);
                        showMessage('userMessage', '❌ Error loading users: ' + error.message, 'error');
                    }
                }

                // Display users
                function displayUsers(users) {
                    const usersList = document.getElementById('usersList');
                    
                    if (users.length === 0) {
                        usersList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No users found</div>';
                        return;
                    }

                    const usersHTML = users.map(user => {
                        const roleColors = {
                            admin: { bg: '#f8d7da', text: '#721c24' },
                            dispatcher: { bg: '#fff3cd', text: '#856404' },
                            driver: { bg: '#d4edda', text: '#155724' }
                        };
                        const colors = roleColors[user.role] || { bg: '#e9ecef', text: '#495057' };

                        return \`
                            <div class="user-item \${user.role}">
                                <div style="flex: 1;">
                                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">\${user.username}</div>
                                    <div style="color: #666; font-size: 14px; margin-bottom: 4px;">\${user.email}</div>
                                    <span style="background: \${colors.bg}; color: \${colors.text}; padding: 2px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase; font-weight: bold;">\${user.role}</span>
                                </div>
                                <div>
                                    <button onclick="deleteUser('\${user._id}', '\${user.username}')" class="btn btn-danger" style="padding: 8px 16px; font-size: 12px;">🗑️ Delete</button>
                                </div>
                            </div>
                        \`;
                    }).join('');

                    usersList.innerHTML = usersHTML;
                }

                // Delete user
                async function deleteUser(userId, username) {
                    if (confirm('Delete user "' + username + '"? This will remove them from the driver app.')) {
                        try {
                            const response = await fetch('/api/users/' + userId, {
                                method: 'DELETE'
                            });

                            if (response.ok) {
                                showMessage('userMessage', '✅ User "' + username + '" deleted successfully', 'success');
                                loadUsers();
                            } else {
                                showMessage('userMessage', '❌ Failed to delete user', 'error');
                            }
                        } catch (error) {
                            console.error('Delete user error:', error);
                            showMessage('userMessage', '❌ Error: ' + error.message, 'error');
                        }
                    }
                }

                // Load notifications
                async function loadNotifications() {
                    try {
                        const response = await fetch('/api/notifications');
                        
                        if (response.ok) {
                            currentNotifications = await response.json();
                            displayNotifications(currentNotifications);
                            updateNotificationCount();
                        } else {
                            document.getElementById('notificationsList').innerHTML = 
                                '<div style="text-align: center; padding: 20px; color: #dc3545;">Failed to load notifications</div>';
                        }
                    } catch (error) {
                        console.error('Load notifications error:', error);
                        document.getElementById('notificationsList').innerHTML = 
                            '<div style="text-align: center; padding: 20px; color: #dc3545;">Error: ' + error.message + '</div>';
                    }
                }

                // Display notifications
                function displayNotifications(notifications) {
                    const notificationsList = document.getElementById('notificationsList');
                    
                    if (notifications.length === 0) {
                        notificationsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No notifications yet. Drivers can send notifications from the driver app.</div>';
                        return;
                    }

                    const notificationsHTML = notifications.map(notification => {
                        const time = new Date(notification.timestamp).toLocaleString();
                        const statusIcon = notification.status === 'arrived' ? '✅' : '🕐';
                        
                        return \`
                            <div class="notification-item">
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <strong>\${statusIcon} \${notification.driver}</strong>
                                        <small style="color: #666;">\${time}</small>
                                    </div>
                                    <div style="margin-bottom: 4px;"><strong>Status:</strong> \${notification.status}</div>
                                    <div style="margin-bottom: 4px;"><strong>Location:</strong> \${notification.location || 'Unknown'}</div>
                                    <div><strong>ETA:</strong> \${notification.estimatedArrival || 'N/A'}</div>
                                </div>
                            </div>
                        \`;
                    }).join('');

                    notificationsList.innerHTML = notificationsHTML;
                }

                // Clear notifications
                function clearNotifications() {
                    if (confirm('Clear all notifications? This cannot be undone.')) {
                        currentNotifications = [];
                        displayNotifications([]);
                        updateNotificationCount();
                        showMessage('userMessage', '✅ All notifications cleared', 'success');
                    }
                }

                // Update counts
                function updateUserCount() {
                    document.getElementById('userCount').textContent = '👥 Users: ' + currentUsers.length;
                }

                function updateNotificationCount() {
                    document.getElementById('notificationCount').textContent = '📱 Notifications: ' + currentNotifications.length;
                }

                // Test driver app
                function testDriverApp() {
                    window.open('/driver', '_blank');
                }

                // Utility function to show messages
                function showMessage(elementId, message, type) {
                    const element = document.getElementById(elementId);
                    if (element) {
                        element.innerHTML = '<div class="message ' + type + '">' + message + '</div>';
                        
                        if (type === 'success') {
                            setTimeout(() => {
                                element.innerHTML = '';
                            }, 4000);
                        }
                    }
                }

                // Auto-login for demo
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('Admin panel loaded - ready for login');
                });
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// Driver app - Enhanced version
app.get('/driver', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Driver App - Driver Return System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; color: #333;
                }
                .container { max-width: 400px; margin: 0 auto; padding: 20px; min-height: 100vh; display: flex; flex-direction: column; }
                .header { text-align: center; color: white; margin-bottom: 30px; }
                .card {
                    background: white; border-radius: 20px; padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1); flex: 1;
                }
                .btn {
                    width: 100%; padding: 20px; border: none;
                    border-radius: 12px; font-size: 18px; font-weight: bold;
                    cursor: pointer; margin-bottom: 15px; color: white; transition: all 0.3s;
                }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn:hover:not(:disabled) { transform: translateY(-2px); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                .btn-status { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); }
                .btn-arrived { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
                .message { 
                    padding: 15px; border-radius: 8px; margin: 15px 0; 
                    text-align: center; font-weight: bold;
                }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                .hidden { display: none; }
                select { 
                    width: 100%; padding: 15px; border: 2px solid #e1e5e9; 
                    border-radius: 12px; margin-bottom: 15px; font-size: 16px; background: #f8f9fa;
                }
                select:focus { outline: none; border-color: #667eea; background: white; }
                .sync-info {
                    background: #e8f5e8; border: 1px solid #c3e6cb; color: #155724;
                    padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;
                }
                .driver-info {
                    background: #f8f9fa; padding: 20px; border-radius: 12px;
                    margin-bottom: 20px; text-align: center; border-left: 4px solid #667eea;
                }
                .driver-name { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px; }
                .current-time { color: #666; font-size: 16px; margin-bottom: 10px; }
                .logout-btn {
                    background: transparent; color: #dc3545; border: 1px solid #dc3545;
                    padding: 8px 16px; font-size: 14px; border-radius: 6px; cursor: pointer;
                }
                .logout-btn:hover { background: #dc3545; color: white; }
                .notification-history {
                    background: #f8f9fa; padding: 15px; border-radius: 8px;
                    margin-top: 20px; max-height: 300px; overflow-y: auto;
                }
                .history-item {
                    background: white; padding: 10px; border-radius: 6px;
                    margin-bottom: 8px; font-size: 14px; color: #666;
                    border-left: 3px solid #667eea;
                }
                .loading {
                    display: inline-block; width: 20px; height: 20px;
                    border: 3px solid #ffffff; border-radius: 50%;
                    border-top-color: transparent; animation: spin 1s ease-in-out infinite;
                    margin-right: 10px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚚 Driver App</h1>
                    <p>Quick warehouse return notification</p>
                </div>

                <!-- Driver Selection Screen -->
                <div class="card" id="loginScreen">
                    <h2 style="text-align: center; margin-bottom: 20px;">Select Your Name</h2>
                    
                    <div class="sync-info">
                        🔗 <strong>Connected to Admin System</strong><br>
                        Drivers created in admin panel appear here automatically.
                        <button onclick="loadDriversList()" style="background: #17a2b8; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-left: 10px; cursor: pointer;">🔄 Refresh</button>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #555;">Choose your name from the list:</label>
                        <select id="driverSelect">
                            <option value="">-- Loading drivers... --</option>
                        </select>
                    </div>

                    <button class="btn btn-primary" onclick="selectDriver()" id="loginBtn" disabled>
                        Begin Check-Out
                    </button>

                    <div id="loginMessage"></div>
                    
                    <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                        <small style="color: #0c5460;">
                            Don't see your name? <a href="/admin" target="_blank" style="color: #667eea; font-weight: bold;">Ask admin to add you</a>
                        </small>
                    </div>
                </div>

                <!-- Main App Screen -->
                <div class="card hidden" id="mainScreen">
                    <div class="driver-info">
                        <div class="driver-name" id="selectedDriverName">Driver Name</div>
                        <div class="current-time" id="currentTime"></div>
                        <button class="logout-btn" onclick="logoutDriver()">🚪 Logout</button>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <button class="btn btn-status" onclick="sendNotification('30 minutes away', this)">
                            🕐 30 MINUTES AWAY
                        </button>
                        
                        <button class="btn btn-status btn-arrived" onclick="sendNotification('arrived', this)">
                            ✅ ARRIVED AT WAREHOUSE
                        </button>
                    </div>

                    <div id="statusMessage"></div>

                    <div class="notification-history">
                        <h3 style="font-size: 16px; margin-bottom: 10px; color: #555;">📋 Your Recent Notifications</h3>
                        <div id="notificationHistory">
                            <div class="history-item">No notifications sent yet</div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="/admin" target="_blank" style="color: #667eea; text-decoration: none; font-weight: bold;">⚙️ View Admin Panel</a>
                    </div>
                </div>
            </div>

            <script>
                let currentDriver = null;
                let notificationHistory = [];

                // Initialize app
                document.addEventListener('DOMContentLoaded', function() {
                    updateTime();
                    setInterval(updateTime, 1000);
                    checkExistingLogin();
                    loadDriversList();
                });

                // Load drivers from API
                async function loadDriversList() {
                    try {
                        showMessage('loginMessage', 'Loading drivers from admin system...', 'info');
                        
                        const response = await fetch('/api/auth/drivers');
                        
                        if (response.ok) {
                            const drivers = await response.json();
                            populateDriverDropdown(drivers);
                            
                            if (drivers.length > 0) {
                                showMessage('loginMessage', '✅ Loaded ' + drivers.length + ' drivers from admin panel', 'success');
                            } else {
                                showMessage('loginMessage', '⚠️ No drivers found. Create drivers in admin panel first.', 'warning');
                            }
                        } else {
                            throw new Error('Failed to load drivers');
                        }
                    } catch (error) {
                        console.error('Error loading drivers:', error);
                        showMessage('loginMessage', '❌ Error loading drivers. Using demo list.', 'error');
                        loadFallbackDrivers();
                    }
                }

                function populateDriverDropdown(drivers) {
                    const driverSelect = document.getElementById('driverSelect');
                    const loginBtn = document.getElementById('loginBtn');
                    
                    driverSelect.innerHTML = '<option value="">-- Select Your Name --</option>';
                    
                    drivers.forEach(driver => {
                        const option = document.createElement('option');
                        option.value = JSON.stringify({ 
                            id: driver._id, 
                            username: driver.username,
                            email: driver.email || '',
                            role: driver.role
                        });
                        option.textContent = driver.username;
                        driverSelect.appendChild(option);
                    });
                    
                    driverSelect.addEventListener('change', function() {
                        loginBtn.disabled = this.value === '';
                    });
                }

                function loadFallbackDrivers() {
                    const fallbackDrivers = [
                        { _id: 'demo1', username: 'John Smith', role: 'driver' },
                        { _id: 'demo2', username: 'Sarah Johnson', role: 'driver' },
                        { _id: 'demo3', username: 'Mike Davis', role: 'driver' }
                    ];
                    populateDriverDropdown(fallbackDrivers);
                }

                function checkExistingLogin() {
                    const savedDriver = sessionStorage.getItem('selectedDriver');
                    if (savedDriver) {
                        try {
                            currentDriver = JSON.parse(savedDriver);
                            showMainScreen();
                            loadStoredHistory();
                        } catch (e) {
                            sessionStorage.removeItem('selectedDriver');
                            showLoginScreen();
                        }
                    } else {
                        showLoginScreen();
                    }
                }

                function selectDriver() {
                    const driverSelect = document.getElementById('driverSelect');
                    
                    if (!driverSelect.value) {
                        showMessage('loginMessage', '❌ Please select your name', 'error');
                        return;
                    }

                    try {
                        currentDriver = JSON.parse(driverSelect.value);
                        sessionStorage.setItem('selectedDriver', JSON.stringify(currentDriver));
                        
                        showMainScreen();
                        loadStoredHistory();
                        
                        showMessage('statusMessage', 'Welcome back, ' + currentDriver.username + '! 🚚', 'success');
                    } catch (error) {
                        console.error('Driver selection error:', error);
                        showMessage('loginMessage', '❌ Error selecting driver', 'error');
                    }
                }

                function logoutDriver() {
                    if (confirm('Are you sure you want to logout?')) {
                        sessionStorage.removeItem('selectedDriver');
                        currentDriver = null;
                        notificationHistory = [];
                        
                        document.getElementById('driverSelect').value = '';
                        document.getElementById('loginBtn').disabled = true;
                        
                        showLoginScreen();
                        showMessage('loginMessage', '✅ Logged out successfully. Have a safe trip! 🚛', 'success');
                    }
                }

                function showMainScreen() {
                    document.getElementById('loginScreen').classList.add('hidden');
                    document.getElementById('mainScreen').classList.remove('hidden');
                    document.getElementById('selectedDriverName').textContent = currentDriver.username;
                    displayNotificationHistory();
                }

                function showLoginScreen() {
                    document.getElementById('loginScreen').classList.remove('hidden');
                    document.getElementById('mainScreen').classList.add('hidden');
                    clearMessages();
                }

                function updateTime() {
                    const now = new Date();
                    const timeString = now.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    const timeElement = document.getElementById('currentTime');
                    if (timeElement) {
                        timeElement.textContent = timeString;
                    }
                }

                async function sendNotification(status, button) {
                    if (!currentDriver) {
                        showMessage('statusMessage', '❌ Please select a driver first', 'error');
                        return;
                    }

                    const originalText = button.innerHTML;
                    button.disabled = true;
                    button.innerHTML = '<span class="loading"></span>Sending...';

                    try {
                        const location = await getCurrentLocation();
                        const estimatedArrival = calculateETA(status);
                        
                        const notificationData = {
                            driver: currentDriver.username,
                            driverId: currentDriver.id,
                            status: status,
                            location: location,
                            estimatedArrival: estimatedArrival,
                            warehouse: 'Main Warehouse',
                            company: 'Your Company Inc.',
                            timestamp: new Date().toISOString()
                        };

                        const response = await fetch('/api/notifications/simple', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(notificationData)
                        });

                        if (response.ok) {
                            const statusMsg = status === 'arrived' ? 
                                'Welcome to the warehouse! 🏭 Dispatch has been notified.' : 
                                'Dispatch notified of your 30-minute ETA! 🕐';
                            showMessage('statusMessage', '✅ ' + statusMsg, 'success');
                            console.log('📱 Notification sent to admin panel');
                        } else {
                            throw new Error('Failed to send notification');
                        }

                        addToHistory(notificationData);

                    } catch (error) {
                        console.error('Notification error:', error);
                        showMessage('statusMessage', '❌ Failed to send notification. Please try again.', 'error');
                    } finally {
                        setTimeout(() => {
                            button.disabled = false;
                            button.innerHTML = originalText;
                        }, 2000);
                    }
                }

                function getCurrentLocation() {
                    return new Promise((resolve) => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const lat = position.coords.latitude.toFixed(6);
                                    const lng = position.coords.longitude.toFixed(6);
                                    resolve(lat + ', ' + lng);
                                },
                                () => resolve('Location unavailable'),
                                { timeout: 5000 }
                            );
                        } else {
                            resolve('Location unavailable');
                        }
                    });
                }

                function calculateETA(status) {
                    if (status === 'arrived') {
                        return 'At warehouse';
                    } else if (status === '30 minutes away') {
                        const eta = new Date(Date.now() + 30 * 60000);
                        return eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    }
                    return 'Unknown';
                }

                function addToHistory(notification) {
                    notificationHistory.unshift({
                        ...notification,
                        id: Date.now()
                    });
                    
                    if (notificationHistory.length > 10) {
                        notificationHistory = notificationHistory.slice(0, 10);
                    }
                    
                    saveHistory();
                    displayNotificationHistory();
                }

                function displayNotificationHistory() {
                    const historyContainer = document.getElementById('notificationHistory');
                    
                    if (notificationHistory.length === 0) {
                        historyContainer.innerHTML = '<div class="history-item">No notifications sent yet</div>';
                        return;
                    }

                    const historyHTML = notificationHistory.map(item => {
                        const time = new Date(item.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        const icon = item.status === 'arrived' ? '✅' : '🕐';
                        
                        return \`
                            <div class="history-item">
                                \${icon} \${time} - \${item.status}<br>
                                <small>ETA: \${item.estimatedArrival}</small>
                            </div>
                        \`;
                    }).join('');

                    historyContainer.innerHTML = historyHTML;
                }

                function saveHistory() {
                    if (!currentDriver) return;
                    const historyKey = 'history_' + (currentDriver.id || currentDriver.username);
                    sessionStorage.setItem(historyKey, JSON.stringify(notificationHistory));
                }

                function loadStoredHistory() {
                    if (!currentDriver) return;
                    
                    const historyKey = 'history_' + (currentDriver.id || currentDriver.username);
                    const stored = sessionStorage.getItem(historyKey);
                    
                    if (stored) {
                        try {
                            notificationHistory = JSON.parse(stored);
                            displayNotificationHistory();
                        } catch (e) {
                            console.error('Error loading history:', e);
                            notificationHistory = [];
                        }
                    }
                }

                function showMessage(elementId, message, type) {
                    const element = document.getElementById(elementId);  
                    if (element) {
                        element.innerHTML = '<div class="message ' + type + '">' + message + '</div>';
                        
                        if (type === 'success') {
                            setTimeout(() => {
                                element.innerHTML = '';
                            }, 5000);
                        }
                    }
                }

                function clearMessages() {
                    document.getElementById('loginMessage').innerHTML = '';
                    const statusMsg = document.getElementById('statusMessage');
                    if (statusMsg) statusMsg.innerHTML = '';
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
