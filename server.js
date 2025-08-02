const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store notifications
let notifications = [];

// Routes
app.get('/', (req, res) => {
  res.send('Driver Return System is running');
});

app.post('/api/notifications/simple', (req, res) => {
  notifications.push(req.body);
  res.json({ success: true });
});

app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
