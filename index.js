require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./src/db');
const profilesRouter = require('./src/routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — required by grading script
app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Insighta Labs Intelligence Query Engine' });
});

// Routes
app.use('/api/profiles', profilesRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
