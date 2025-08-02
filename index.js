const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint - REQUIRED for Railway
app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Driver Return System is running',
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'Driver Return System',
    version: '1.0.0',
    status: 'operational'
  });
});

// Store driver data (in-memory for now)
let drivers = [];

// Driver endpoints
app.post('/api/checkin', (req, res) => {
  const { driverId, name, vehicle } = req.body;
  const checkIn = {
    driverId,
    name,
    vehicle,
    checkInTime: new Date(),
    status: 'out'
  };
  drivers.push(checkIn);
  res.status(201).json({ message: 'Driver checked in successfully', checkIn });
});

app.post('/api/return', (req, res) => {
  const { driverId } = req.body;
  const driver = drivers.find(d => d.driverId === driverId && d.status === 'out');
  if (driver) {
    driver.status = 'returned';
    driver.returnTime = new Date();
    res.json({ message: 'Driver returned successfully', driver });
  } else {
    res.status(404).json({ error: 'Driver not found or already returned' });
  }
});

app.get('/api/drivers',
