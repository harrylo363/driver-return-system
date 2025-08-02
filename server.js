const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (replace with database in production)
let notifications = [];
let users = [
  { id: 1, username: 'Admin User', email: 'admin@company.com', role: 'admin' },
  { id: 2, username: 'John Smith', email: 'john.smith@company.com', role: 'driver' },
  { id: 3, username: 'Sarah Johnson', email: 'sarah.johnson@company.com', role: 'driver' },
  { id: 4, username: 'Mike Davis', email: 'mike.davis@company.com', role: 'driver' },
  { id: 5, username: 'Lisa Wilson', email: 'lisa.wilson@company.com', role: 'driver' },
  { id: 6, username: 'Dispatcher One', email: 'dispatcher@company.com', role: 'dispatcher' }
];
let reports = [];

// Root route
app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Driver Return System is running',
    timestamp: new Date().toISOString()
  });
});

// Admin endpoints
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@company.com' && password === 'admin123') {
    res.json({ success: true, token: 'demo-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Users endpoints
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: users.length + 1,
    ...req.body
  };
  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// Notifications endpoint
app.post('/api/notifications/simple', (req, res) => {
  const notification = {
    id: Date.now(),
    ...req.body,
    receivedAt: new Date().toISOString()
  };
  
  notifications.push(notification);
  
  // Keep only last 100 notifications
  if (notifications.length > 100) {
    notifications = notifications.slice(-100);
  }
  
  res.json({ 
    success: true, 
    message: 'Notification received',
    notification: notification 
  });
});

app.get('/api/notifications', (req, res) => {
  res.json(notifications.slice(-20));
});

// Reports endpoints
app.get('/api/reports', (req, res) => {
  res.json({
    total: 15,
    noIssues: 11,
    minorIssues: 3,
    criticalIssues: 1,
    reports: [
      {
        id: 1,
        truck: 'T-007',
        trailer: 'TR-201',
        driver: 'Mike Davis',
        date: new Date(Date.now() - 86400000).toISOString(),
        status: 'critical',
        issue: 'Hydraulic leak detected, immediate attention required'
      },
      {
        id: 2,
        truck: 'T-003',
        trailer: 'TR-108',
        driver: 'Sarah Johnson',
        date: new Date(Date.now() - 90000000).toISOString(),
        status: 'good',
        issue: 'Vehicle passed inspection'
      },
      {
        id: 3,
        truck: 'T-001',
        trailer: 'TR-105',
        driver: 'John Smith',
        date: new Date(Date.now() - 172800000).toISOString(),
        status: 'minor',
        issue: 'Small scratch on trailer side panel'
      }
    ]
  });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: users.length,
    activeDrivers: users.filter(u => u.role === 'driver').length,
    pendingReports: 3,
    criticalIssues: 1
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
