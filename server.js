const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store notifications in memory (in production, use a database)
let notifications = [];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Driver Return System is running' });
});

// Handle driver notifications
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

// Get recent notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications.slice(-20)); // Return last 20 notifications
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/*.html', (req, res) => {
  const filename = req.params[0] + '.html';
  res.sendFile(path.join(__dirname, 'public', filename), (err) => {
    if (err) {
      res.redirect('/');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
