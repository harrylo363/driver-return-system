const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
let notifications = [];
let inspectionReports = [];

// Root route
app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Driver Return System is running',
    timestamp: new Date().toISOString()
  });
});

// Driver notifications endpoint
app.post('/api/notifications/simple', (req, res) => {
  const notification = {
    _id: Date.now().toString(),
    ...req.body,
    receivedAt: new Date().toISOString()
  };
  
  notifications.unshift(notification);
  
  // Keep only last 100 notifications
  if (notifications.length > 100) {
    notifications = notifications.slice(0, 100);
  }
  
  res.json({ 
    success: true, 
    message: 'Notification received',
    notification: notification 
  });
});

// Get notifications list for dispatcher
app.get('/api/notifications/list', (req, res) => {
  res.json({ 
    success: true,
    notifications: notifications.slice(0, 50) // Return last 50
  });
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications.slice(0, 20));
});

// Inspection reports endpoint
app.post('/api/inspections', (req, res) => {
  const inspection = {
    id: Date.now().toString(),
    ...req.body,
    submittedAt: new Date().toISOString()
  };
  
  inspectionReports.push(inspection);
  
  res.json({ 
    success: true, 
    message: 'Inspection report saved',
    inspection: inspection 
  });
});

// Get inspection reports
app.get('/api/inspections', (req, res) => {
  res.json({
    success: true,
    reports: inspectionReports
  });
});

// Serve HTML files
app.get('/*.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.params[0] + '.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
