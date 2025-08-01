// Admin panel with full functionality
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin Panel - Driver Return System</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: #333;
                }
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; color: white; margin-bottom: 30px; }
                .card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                .hidden { display: none; }
                .form-group { margin-bottom: 20px; }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #555;
                }
                .form-group input, .form-group select {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e1e5e9;
                    border-radius: 8px;
                    font-size: 16px;
                    background: #f8f9fa;
                }
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-right: 10px;
                    margin-bottom: 10px;
                    transition: all 0.3s;
                }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-info { background: #17a2b8; color: white; }
                .btn-danger { background: #dc3545; color: white; }
                .message {
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    font-weight: bold;
                }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                .tab-navigation {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 30px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .tab-btn {
                    padding: 12px 24px;
                    border: 2px solid #667eea;
                    background: white;
                    color: #667eea;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    transition: all 0.3s;
                }
                .tab-btn.active {
                    background: #667eea;
                    color: white;
                }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .users-list {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                }
                .user-item {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid #667eea;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .user-item.admin { border-left-color: #dc3545; }
                .user-item.dispatcher { border-left-color: #ffc107; }
                .user-item.driver { border-left-color: #28a745; }
                .notifications-list {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .notification-item {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid #17a2b8;
                }
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

                <!-- Login Card -->
                <div class="card" id="loginCard">
                    <h2>Admin Login</h2>
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
                        <button class="tab-btn" onclick="showTab('notifications', this)">📱 Notifications</button>
                        <button class="tab-btn" onclick="showTab('inspections', this)">🚛 Inspections</button>
                    </div>

                    <!-- User Management Tab -->
                    <div id="usersTab" class="tab-content">
                        <h2>Create New User</h2>
                        <div class="grid">
                            <div>
                                <div class="form-group">
                                    <label for="newUsername">Username</label>
                                    <input type="text" id="newUsername" placeholder="Enter username">
                                </div>
                                <div class="form-group">
                                    <label for="newEmail">Email</label>
                                    <input type="text" id="newEmail" placeholder="Enter email address">
                                </div>
                            </div>
                            <div>
                                <div class="form-group">
                                    <label for="newPassword">Password</label>
                                    <input type="text" id="newPassword" placeholder="Enter password">
                                </div>
                                <div class="form-group">
                                    <label for="newRole">Role</label>
                                    <select id="newRole">
                                        <option value="driver">Driver</option>
                                        <option value="dispatcher">Dispatcher</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 20px;">
                            <button class="btn btn-success" onclick="createUser()">✅ Create User</button>
                            <button class="btn btn-info" onclick="loadUsers()">🔄 Refresh Users</button>
                        </div>
                        <div id="userMessage"></div>
                        
                        <div class="users-list">
                            <h3>Existing Users</h3>
                            <div id="usersList">Loading users...</div>
                        </div>
                    </div>

                    <!-- Notifications Tab -->
                    <div id="notificationsTab" class="tab-content hidden">
                        <h2>📱 Driver Notifications</h2>
                        <div style="text-align: center; margin-bottom: 20px;">
                            <button class="btn btn-info" onclick="loadNotifications()">🔄 Refresh Notifications</button>
                        </div>
                        <div class="notifications-list">
                            <div id="notificationsList">Loading notifications...</div>
                        </div>
                    </div>

                    <!-- Inspections Tab -->
                    <div id="inspectionsTab" class="tab-content hidden">
                        <h2>🚛 Inspection Reports</h2>
                        <div style="text-align: center; margin-bottom: 20px;">
                            <button class="btn btn-info" onclick="loadInspections()">🔄 Refresh Reports</button>
                        </div>
                        <div class="notifications-list">
                            <div id="inspectionsList">Loading inspection reports...</div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                let authToken = null;

                // Admin login
                async function adminLogin() {
                    const email = document.getElementById('adminEmail').value.trim();
                    const password = document.getElementById('adminPassword').value.trim();

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
                            showMessage('userMessage', 'Welcome, ' + data.user.username + '!', 'success');
                            loadUsers();
                        } else {
                            showMessage('loginMessage', data.error || 'Login failed', 'error');
                        }
                    } catch (error) {
                        showMessage('loginMessage', 'Login failed: ' + error.message, 'error');
                    }
                }

                // Tab navigation
                function showTab(tabName, buttonElement) {
                    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
                    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                    
                    document.getElementById(tabName + 'Tab').classList.remove('hidden');
                    buttonElement.classList.add('active');
                    
                    if (tabName === 'inspections') loadInspections();
                }

                // Create user
                async function createUser() {
                    const username = document.getElementById('newUsername').value.trim();
                    const email = document.getElementById('newEmail').value.trim();
                    const password = document.getElementById('newPassword').value.trim();
                    const role = document.getElementById('newRole').value;

                    if (!username || !password) {
                        showMessage('userMessage', 'Username and password are required', 'error');
                        return;
                    }

                    try {
                        const response = await fetch('/api/users', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + authToken
                            },
                            body: JSON.stringify({ 
                                username, 
                                email: email || username + '@company.com', 
                                password, 
                                role 
                            })
                        });

                        const data = await response.json();

                        if (response.ok) {
                            showMessage('userMessage', '✅ ' + role + ' "' + username + '" created successfully!', 'success');
                            document.getElementById('newUsername').value = '';
                            document.getElementById('newEmail').value = '';
                            document.getElementById('newPassword').value = '';
                            loadUsers();
                        } else {
                            showMessage('userMessage', data.error || 'Failed to create user', 'error');
                        }
                    } catch (error) {
                        showMessage('userMessage', 'Error: ' + error.message, 'error');
                    }
                }

                // Load users
                async function loadUsers() {
                    try {
                        const response = await fetch('/api/users', {
                            headers: { 'Authorization': 'Bearer ' + authToken }
                        });

                        if (response.ok) {
                            const users = await response.json();
                            displayUsers(users);
                            showMessage('userMessage', '✅ Loaded ' + users.length + ' users', 'success');
                        } else {
                            showMessage('userMessage', 'Failed to load users', 'error');
                        }
                    } catch (error) {
                        showMessage('userMessage', 'Error loading users: ' + error.message, 'error');
                    }
                }

                // Display users
                function displayUsers(users) {
                    const usersList = document.getElementById('usersList');
                    
                    if (users.length === 0) {
                        usersList.innerHTML = '<div class="info message">No users found</div>';
                        return;
                    }

                    const usersHTML = users.map(user => {
                        const roleColors = {
                            admin: { bg: '#f8d7da', text: '#721c24' },
                            dispatcher: { bg: '#fff3cd', text: '#856404' },
                            driver: { bg: '#d4edda', text: '#155724' }
                        };
                        const colors = roleColors[user.role] || { bg: '#e9ecef', text: '#495057' };

                        return '<div class="user-item ' + user.role + '">' +
                            '<div style="flex: 1;">' +
                                '<div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">' + user.username + '</div>' +
                                '<div style="color: #666; font-size: 14px; margin-bottom: 4px;">' + user.email + '</div>' +
                                '<span style="background: ' + colors.bg + '; color: ' + colors.text + '; padding: 2px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase; font-weight: bold;">' + user.role + '</span>' +
                            '</div>' +
                            '<div>' +
                                '<button onclick="deleteUser(\'' + user._id + '\', \'' + user.username + '\')" style="background: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">🗑️ Delete</button>' +
                            '</div>' +
                        '</div>';
                    }).join('');

                    usersList.innerHTML = usersHTML;
                }

                // Delete user
                async function deleteUser(userId, username) {
                    if (confirm('Delete user "' + username + '"?')) {
                        try {
                            const response = await fetch('/api/users/' + userId, {
                                method: 'DELETE',
                                headers: { 'Authorization': 'Bearer ' + authToken }
                            });

                            if (response.ok) {
                                showMessage('userMessage', '✅ User "' + username + '" deleted', 'success');
                                loadUsers();
                            } else {
                                showMessage('userMessage', 'Failed to delete user', 'error');
                            }
                        } catch (error) {
                            showMessage('userMessage', 'Error: ' + error.message, 'error');
                        }
                    }
                }

                // Load notifications
                async function loadNotifications() {
                    try {
                        const response = await fetch('/api/notifications');
                        
                        if (response.ok) {
                            const notifications = await response.json();
                            displayNotifications(notifications);
                        } else {
                            document.getElementById('notificationsList').innerHTML = '<div class="error message">Failed to load notifications</div>';
                        }
                    } catch (error) {
                        document.getElementById('notificationsList').innerHTML = '<div class="error message">Error: ' + error.message + '</div>';
                    }
                }

                // Display notifications
                function displayNotifications(notifications) {
                    const notificationsList = document.getElementById('notificationsList');
                    
                    if (notifications.length === 0) {
                        notificationsList.innerHTML = '<div class="info message">No notifications yet</div>';
                        return;
                    }

                    const notificationsHTML = notifications.map(notification => {
                        const time = new Date(notification.timestamp).toLocaleString();
                        const statusIcon = notification.status === 'arrived' ? '✅' : '🕐';
                        
                        return '<div class="notification-item">' +
                            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
                                '<strong>' + statusIcon + ' ' + notification.driver + '</strong>' +
                                '<small style="color: #666;">' + time + '</small>' +
                            '</div>' +
                            '<div style="margin-bottom: 4px;"><strong>Status:</strong> ' + notification.status + '</div>' +
                            '<div style="margin-bottom: 4px;"><strong>Location:</strong> ' + (notification.location || 'Unknown') + '</div>' +
                            '<div><strong>ETA:</strong> ' + (notification.estimatedArrival || 'N/A') + '</div>' +
                        '</div>';
                    }).join('');

                    notificationsList.innerHTML = notificationsHTML;
                }

                // Load inspections
                async function loadInspections() {
                    try {
                        const response = await fetch('/api/inspections');
                        
                        if (response.ok) {
                            const inspections = await response.json();
                            displayInspections(inspections);
                        } else {
                            document.getElementById('inspectionsList').innerHTML = '<div class="error message">Failed to load inspections</div>';
                        }
                    } catch (error) {
                        document.getElementById('inspectionsList').innerHTML = '<div class="error message">Error: ' + error.message + '</div>';
                    }
                }

                // Display inspections
                function displayInspections(inspections) {
                    const inspectionsList = document.getElementById('inspectionsList');
                    
                    if (inspections.length === 0) {
                        inspectionsList.innerHTML = '<div class="info message">No inspection reports yet</div>';
                        return;
                    }

                    const inspectionsHTML = inspections.map(inspection => {
                        const time = new Date(inspection.checkInTime).toLocaleString();
                        const statusColors = {
                            good: { bg: '#d4edda', color: '#155724', icon: '✅' },
                            issues: { bg: '#fff3cd', color: '#856404', icon: '⚠️' },
                            critical: { bg: '#f8d7da', color: '#721c24', icon: '🚨' }
                        };
                        const status = statusColors[inspection.status] || statusColors.good;
                        
                        return '<div class="notification-item">' +
                            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
                                '<strong>' + inspection.driver + '</strong>' +
                                '<span style="background: ' + status.bg + '; color: ' + status.color + '; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">' +
                                    status.icon + ' ' + inspection.status.toUpperCase() +
                                '</span>' +
                            '</div>' +
                            '<div style="margin-bottom: 4px;"><strong>Vehicle:</strong> ' + inspection.tractorNumber + ' / ' + (inspection.trailerNumber || 'N/A') + '</div>' +
                            '<div style="margin-bottom: 4px;"><strong>Date:</strong> ' + time + '</div>' +
                            '<div style="margin-bottom: 4px;"><strong>Location:</strong> ' + (inspection.location || 'Unknown') + '</div>' +
                            (inspection.damageFound ? '<div><strong>Issues:</strong> ' + inspection.damageFound + '</div>' : '') +
                        '</div>';
                    }).join('');

                    inspectionsList.innerHTML = inspectionsHTML;
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

                // Auto-load users on page load
                setTimeout(() => {
                    if (authToken) loadUsers();
                }, 1000);
            </script>
        </body>
        </html>
    `);
});// server.js - Full featured server with MongoDB integration
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Driver Return System server...');
console.log('📊 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://appuser:hNOT8muSZQfzZnqb@cluster0.lryi4zm.mongodb.net/driver_return_app?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    console.log('📊 Database:', mongoose.connection.name);
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Server will continue without database');
  });

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'dispatcher', 'driver'], required: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true }
});

// Inspection Report Schema
const inspectionSchema = new mongoose.Schema({
  driver: { type: String, required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tractorNumber: { type: String, required: true },
  trailerNumber: { type: String },
  status: { type: String, enum: ['good', 'issues', 'critical'], required: true },
  damageFound: { type: String, default: '' },
  location: { type: String },
  checkInTime: { type: Date, default: Date.now },
  dispatcherNotes: { type: String, default: '' },
  isResolved: { type: Boolean, default: false }
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
  driver: { type: String, required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, required: true },
  location: { type: String },
  estimatedArrival: { type: String },
  warehouse: { type: String, default: 'Main Warehouse' },
  company: { type: String, default: 'Your Company Inc.' },
  timestamp: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false }
});

// Models
const User = mongoose.model('User', userSchema);
const Inspection = mongoose.model('Inspection', inspectionSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'driver-return-system-jwt-secret-2024';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Initialize database with demo data
async function initializeDatabase() {
  try {
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('🌱 Initializing database with demo data...');
      
      // Create demo users
      const demoUsers = [
        {
          username: 'admin',
          email: 'admin@company.com',
          password: await bcrypt.hash('admin123!@#', 10),
          role: 'admin'
        },
        {
          username: 'dispatcher1',
          email: 'dispatch@company.com',
          password: await bcrypt.hash('dispatch123', 10),
          role: 'dispatcher'
        },
        {
          username: 'John Smith',
          email: 'john@company.com',
          password: await bcrypt.hash('john123', 10),
          role: 'driver'
        },
        {
          username: 'Sarah Johnson',
          email: 'sarah@company.com',
          password: await bcrypt.hash('sarah123', 10),
          role: 'driver'
        },
        {
          username: 'Mike Davis',
          email: 'mike@company.com',
          password: await bcrypt.hash('mike123', 10),
          role: 'driver'
        }
      ];

      await User.insertMany(demoUsers);
      console.log('✅ Demo users created');

      // Create demo inspection reports
      const johnUser = await User.findOne({ username: 'John Smith' });
      const sarahUser = await User.findOne({ username: 'Sarah Johnson' });
      
      if (johnUser && sarahUser) {
        const demoInspections = [
          {
            driver: 'John Smith',
            driverId: johnUser._id,
            tractorNumber: 'T-001',
            trailerNumber: 'TR-105',
            status: 'issues',
            damageFound: 'Small scratch on trailer side panel',
            location: 'Chicago, IL',
            checkInTime: new Date(Date.now() - 86400000)
          },
          {
            driver: 'Sarah Johnson',
            driverId: sarahUser._id,
            tractorNumber: 'T-003',
            trailerNumber: 'TR-108',
            status: 'good',
            damageFound: '',
            location: 'Denver, CO',
            checkInTime: new Date(Date.now() - 172800000)
          }
        ];

        await Inspection.insertMany(demoInspections);
        console.log('✅ Demo inspection reports created');
      }
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

// Initialize database on startup
if (mongoose.connection.readyState === 1) {
  initializeDatabase();
} else {
  mongoose.connection.once('open', initializeDatabase);
}

// Root route - API status
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Driver Return System API',
        status: 'online',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌',
        routes: {
            dashboard: '/dashboard',
            admin: '/admin',
            driver: '/driver',
            api: {
                auth: '/api/auth/*',
                users: '/api/users',
                notifications: '/api/notifications',
                inspections: '/api/inspections'
            }
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ 
      $or: [{ username }, { email: username }],
      isActive: true 
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all drivers (for driver app dropdown)
app.get('/api/auth/drivers', async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver', isActive: true })
      .select('username email role createdAt')
      .sort({ username: 1 });
    
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    // Fallback to demo data if database fails
    res.json([
      { _id: 'demo1', username: 'John Smith', role: 'driver' },
      { _id: 'demo2', username: 'Sarah Johnson', role: 'driver' },
      { _id: 'demo3', username: 'Mike Davis', role: 'driver' }
    ]);
  }
});

// USER MANAGEMENT ROUTES
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find({ isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// NOTIFICATIONS ROUTES
app.post('/api/notifications/simple', async (req, res) => {
  try {
    const { driver, status, location, estimatedArrival, warehouse, company } = req.body;

    const notification = new Notification({
      driver,
      status,
      location,
      estimatedArrival,
      warehouse: warehouse || 'Main Warehouse',
      company: company || 'Your Company Inc.'
    });

    await notification.save();
    console.log(`📱 New notification from ${driver}: ${status}`);

    res.status(201).json({
      message: 'Notification sent successfully',
      notification
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// INSPECTION ROUTES
app.get('/api/inspections', async (req, res) => {
  try {
    const inspections = await Inspection.find()
      .populate('driverId', 'username email')
      .sort({ checkInTime: -1 });

    res.json(inspections);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// Root route - API status
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Driver Return System API',
        status: 'online',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌',
        routes: {
            dashboard: '/dashboard',
            admin: '/admin',
            driver: '/driver',
            api: {
                auth: '/api/auth/*',
                users: '/api/users',
                notifications: '/api/notifications',
                inspections: '/api/inspections'
            }
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Dashboard routes
app.get('/dashboard', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Driver Return System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">  
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: white;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    text-align: center;
                }
                .card {
                    background: rgba(255,255,255,0.95);
                    color: #333;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                .btn {
                    display: inline-block;
                    padding: 15px 30px;
                    margin: 10px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                    transition: transform 0.2s;
                }
                .btn:hover {
                    transform: translateY(-2px);
                }
                .status {
                    background: #d4edda;
                    color: #155724;
                    padding: 10px;
                    border-radius: 8px;
                    display: inline-block;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🚚 Driver Return System</h1>
                    <div class="status">✅ System is Online</div>
                    <p>Welcome to the Driver Return Management Dashboard</p>
                    <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
                    
                    <div style="margin: 30px 0;">
                        <a href="/admin" class="btn">⚙️ Admin Panel</a>
                        <a href="/driver" class="btn">🚚 Driver App</a>
                    </div>
                    
                    <div style="margin-top: 30px; font-size: 14px; color: #666;">
                        <p>Deployed on Railway • Connected to MongoDB Atlas</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/dashboard.html', (req, res) => {
    res.redirect('/dashboard');
});

// Admin panel
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Panel - Driver Return System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: white;
                }
                .container { max-width: 600px; margin: 0 auto; text-align: center; }
                .card {
                    background: white;
                    color: #333;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                .btn {
                    display: inline-block;
                    padding: 15px 30px;
                    margin: 10px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>⚙️ Admin Panel</h1>
                    <h2>System Status: Online ✅</h2>
                    <p>Server Time: ${new Date().toLocaleString()}</p>
                    <div style="margin: 20px 0;">
                        <a href="/dashboard" class="btn">← Back to Dashboard</a>
                        <a href="/driver" class="btn">🚚 Driver App</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Driver app with full functionality
app.get('/driver', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Driver App - Driver Return System</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    color: #333;
                }
                .container {
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 20px;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                .header { text-align: center; color: white; margin-bottom: 30px; }
                .card {
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    flex: 1;
                }
                .form-group { margin-bottom: 25px; }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #555;
                    font-size: 16px;
                }
                input, select {
                    width: 100%;
                    padding: 15px;
                    border: 2px solid #e1e5e9;
                    border-radius: 12px;
                    font-size: 16px;
                    background: #f8f9fa;
                }
                .btn {
                    width: 100%;
                    padding: 18px;
                    border: none;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-bottom: 15px;
                    transition: all 0.3s;
                }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .btn-status {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    padding: 25px;
                    font-size: 20px;
                    min-height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-arrived { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
                .message {
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    text-align: center;
                    font-weight: bold;
                }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
                .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                .hidden { display: none; }
                .driver-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .driver-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 10px;
                }
                .current-time { color: #666; font-size: 16px; margin-bottom: 10px; }
                .logout-btn {
                    background: transparent;
                    color: #dc3545;
                    border: 1px solid #dc3545;
                    padding: 8px 16px;
                    font-size: 14px;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .status-buttons { display: flex; flex-direction: column; gap: 15px; }
                .notification-history {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .history-item {
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #666;
                    border-left: 3px solid #667eea;
                }
                .loading {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid #ffffff;
                    border-radius: 50%;
                    border-top-color: transparent;
                    animation: spin 1s ease-in-out infinite;
                    margin-right: 10px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .sync-info {
                    background: #e8f5e8;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    font-size: 14px;
                }
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
                    <h2>Select Your Name</h2>
                    
                    <div class="sync-info">
                        🔗 <strong>Connected to Database</strong><br>
                        Your notifications are saved in real-time.
                    </div>
                    
                    <div class="form-group">
                        <label for="driverSelect">Choose your name from the list:</label>
                        <select id="driverSelect">
                            <option value="">-- Loading drivers... --</option>
                        </select>
                    </div>

                    <button class="btn btn-primary" onclick="selectDriver()" id="loginBtn" disabled>
                        Begin Check-Out
                    </button>

                    <div id="loginMessage"></div>
                </div>

                <!-- Main App Screen -->
                <div class="card hidden" id="mainScreen">
                    <div class="driver-info">
                        <div class="driver-name" id="selectedDriverName">Driver Name</div>
                        <div class="current-time" id="currentTime"></div>
                        <button class="logout-btn" onclick="logoutDriver()">🚪 Logout</button>
                    </div>

                    <div class="status-buttons">
                        <button class="btn btn-status" onclick="sendNotification('30 minutes away', this)">
                            🕐 30 MINUTES AWAY
                        </button>
                        
                        <button class="btn btn-status btn-arrived" onclick="sendNotification('arrived', this)">
                            ✅ ARRIVED AT WAREHOUSE
                        </button>
                    </div>

                    <div id="statusMessage"></div>

                    <div class="notification-history">
                        <h3>📋 Your Recent Notifications</h3>
                        <div id="notificationHistory">
                            <div class="history-item">No notifications sent yet</div>
                        </div>
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

                // Load drivers from database
                async function loadDriversList() {
                    try {
                        const response = await fetch('/api/auth/drivers');
                        
                        if (response.ok) {
                            const drivers = await response.json();
                            populateDriverDropdown(drivers);
                            showMessage('loginMessage', '✅ Loaded ' + drivers.length + ' drivers from database', 'success');
                        } else {
                            showMessage('loginMessage', '❌ Failed to load drivers from database', 'error');
                        }
                    } catch (error) {
                        console.error('Error loading drivers:', error);
                        showMessage('loginMessage', '⚠️ Using offline mode', 'warning');
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
                    const savedDriver = localStorage.getItem('selectedDriver');
                    if (savedDriver) {
                        try {
                            currentDriver = JSON.parse(savedDriver);
                            showMainScreen();
                            loadStoredHistory();
                        } catch (e) {
                            localStorage.removeItem('selectedDriver');
                            showLoginScreen();
                        }
                    } else {
                        showLoginScreen();
                    }
                }

                function selectDriver() {
                    const driverSelect = document.getElementById('driverSelect');
                    
                    if (!driverSelect.value) {
                        showMessage('loginMessage', 'Please select your name', 'error');
                        return;
                    }

                    try {
                        currentDriver = JSON.parse(driverSelect.value);
                        localStorage.setItem('selectedDriver', JSON.stringify(currentDriver));
                        
                        showMainScreen();
                        loadStoredHistory();
                        
                        showMessage('statusMessage', 'Welcome back, ' + currentDriver.username + '! 🚚', 'success');
                    } catch (error) {
                        console.error('Driver selection error:', error);
                        showMessage('loginMessage', 'Error selecting driver', 'error');
                    }
                }

                function logoutDriver() {
                    if (confirm('Are you sure you want to logout?')) {
                        localStorage.removeItem('selectedDriver');
                        currentDriver = null;
                        notificationHistory = [];
                        
                        document.getElementById('driverSelect').value = '';
                        document.getElementById('loginBtn').disabled = true;
                        
                        showLoginScreen();
                        showMessage('loginMessage', 'Logged out successfully. Have a safe trip! 🚛', 'success');
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
                        showMessage('statusMessage', 'Please select a driver first', 'error');
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
                            showMessage('statusMessage', '✅ Status "' + status + '" sent successfully to dispatch!', 'success');
                            console.log('Notification sent to database');
                        } else {
                            showMessage('statusMessage', '⚠️ Status "' + status + '" recorded locally (offline mode)', 'warning');
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
                        
                        return '<div class="history-item">' +
                            icon + ' ' + time + ' - ' + item.status + '<br>' +
                            '<small>ETA: ' + item.estimatedArrival + '</small>' +
                        '</div>';
                    }).join('');

                    historyContainer.innerHTML = historyHTML;
                }

                function saveHistory() {
                    if (!currentDriver) return;
                    const historyKey = 'history_' + (currentDriver.id || currentDriver.username);
                    localStorage.setItem(historyKey, JSON.stringify(notificationHistory));
                }

                function loadStoredHistory() {
                    if (!currentDriver) return;
                    
                    const historyKey = 'history_' + (currentDriver.id || currentDriver.username);
                    const stored = localStorage.getItem(historyKey);
                    
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
    `);
});
                .card {
                    background: white;
                    color: #333;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                .btn {
                    display: block;
                    width: 100%;
                    padding: 20px;
                    margin: 15px 0;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 18px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="card">
                    <h1>🚚 Driver App</h1>
                    <h2>System Status: Online ✅</h2>
                    <p>Server Time: ${new Date().toLocaleString()}</p>
                    <a href="#" class="btn">🕐 30 Minutes Away</a>
                    <a href="#" class="btn">✅ Arrived at Warehouse</a>
                    <div style="margin-top: 20px;">
                        <a href="/dashboard" class="btn" style="background: #6c757d;">← Back to Dashboard</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Basic API for testing
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
        error: 'Server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log('❌ 404 - Route not found:', req.originalUrl);
    res.status(404).json({ 
        error: 'Page not found',
        path: req.originalUrl,
        availableRoutes: ['/', '/dashboard', '/admin', '/driver', '/health'],
        timestamp: new Date().toISOString()
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Driver Return System server running on port ${PORT}`);
    console.log(`🌐 Server accessible at your Railway URL`);
    console.log(`📍 Available routes:`);
    console.log(`   - / (API status)`);
    console.log(`   - /dashboard (main dashboard)`);
    console.log(`   - /admin (admin panel with database)`);
    console.log(`   - /driver (driver app with database)`);
    console.log(`   - /health (health check)`);
    console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Connecting... ⏳'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(async () => {
        console.log('✅ Server closed');
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(async () => {
        console.log('✅ Server closed');
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});

module.exports = app;
