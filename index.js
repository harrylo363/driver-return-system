const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Driver Return System API is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Driver Return System is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
