const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Root endpoint
app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Driver Return System is running' });
});

// Simple driver storage
let drivers = [];

// API endpoints
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
  res.json({ message: 'Driver checked in successfully', checkIn });
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

app.get('/api/drivers', (req, res) => {
  res.json(drivers);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
