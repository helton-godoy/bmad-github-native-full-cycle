const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const orchestrationRoutes = require('./routes/orchestration.routes');
const { validateOrigin } = require('./utils/cors.util');

const app = express();

// Middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: validateOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', orchestrationRoutes);

// Health check
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();
  res.status(200).json({ status: 'ok', uptime, timestamp });
});

module.exports = app;
