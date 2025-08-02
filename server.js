const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Driver Return System is running' });
});

// Root route
app.get('/', (req, res) => {
  // Check if driver-app.html exists, otherwise send index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all route for any HTML file requests
app.get('/*.html', (req, res) => {
  const filename = req.params[0] + '.html';
  res.sendFile(path.join(__dirname, 'public', filename), (err) => {
    if (err) {
      // If file doesn't exist, redirect to index.html
      res.redirect('/');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
