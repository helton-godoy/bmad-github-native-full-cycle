const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

module.exports = app;
