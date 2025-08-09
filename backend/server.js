// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const authroutes = require('./routes/authroutes');
const jobroutes = require('./routes/jobroutes');
require('./config/passport'); // passport strategies

const app = express();

// =======================
// Middleware
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Dynamic origins based on environment
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:5501',
    'http://127.0.0.1:5501'
  ];
  
  // Add production frontend URL
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Add backend URL for internal requests
  if (process.env.BACKEND_URL) {
    origins.push(process.env.BACKEND_URL);
  }
  
  // Add the specific Vercel URL as fallback
  origins.push('https://jobtracked-euuf6sl0q-francisiv21s-projects.vercel.app');
  
  return origins;
};

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS rejected origin: ${origin}`);
      console.log(`✅ Allowed origins:`, allowedOrigins);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// =======================
// Sessions & Passport
// =======================
app.set('trust proxy', 1); // needed for secure cookies on Render

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_change_this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Debug middleware (remove in production if not needed)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.path} - Origin: ${req.get('origin')}`);
  }
  next();
});

// =======================
// API Routes
// =======================
app.use('/api/auth', authroutes);
app.use('/api/jobs', jobroutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 5000
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'JobTracker Backend API ✅',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      jobs: '/api/jobs'
    }
  });
});

// =======================
// Database Connection
// =======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// =======================
// Error handling
// =======================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 MongoDB: ${process.env.MONGO_URI ? 'Connected' : 'No URI provided'}`);
  console.log(`🌐 Allowed origins:`, getAllowedOrigins());
});