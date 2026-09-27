const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const orchestrationRoutes = require('./routes/orchestration.routes');

const app = express();

// Middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      const isProduction = process.env.NODE_ENV === 'production';
      const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : isProduction
          ? []
          : ['http://localhost:3000'];

      // Allow requests with no origin (like mobile apps or curl requests)
      // but only if not in production for better security
      if (!origin) {
        if (isProduction) {
          return callback(new Error('Origin required in production'));
        }
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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
