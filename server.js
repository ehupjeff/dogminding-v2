require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./db');
const authRoutes = require('./routes/auth');
const dogRoutes = require('./routes/dogs');
const bookingRoutes = require('./routes/bookings');
const imageRoutes = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/dogs', dogRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', imageRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

async function start() {
  try {
    await initSchema();
    console.log('Database schema initialized');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
