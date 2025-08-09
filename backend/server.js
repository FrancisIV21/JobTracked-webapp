// server.js - Add Passport Configuration
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CORS
app.use(cors({
  origin: [
    'http://localhost:5501',
    'https://jobtracked.vercel.app',  // ← ADD THIS - Your actual Vercel URL
    'https://jobtracked-euuf6sl0q-francisiv21s-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Test routes
app.get('/', (req, res) => {
  res.json({ message: 'Server running with CORS!' });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Load Passport configuration (THIS WAS MISSING!)
console.log('🔄 Loading Passport configuration...');
try {
  require('./config/passport')(passport);
  console.log('✅ Passport configuration loaded successfully');
} catch (error) {
  console.error('❌ Error loading Passport configuration:', error.message);
}

// Load auth routes
console.log('🔄 Loading auth routes...');
try {
  const authRoutes = require('./routes/authroutes');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
  console.error('Full error:', error);
}

// Load job routes
console.log('🔄 Loading job routes...');
try {
  const jobRoutes = require('./routes/jobroutes');
  app.use('/api/jobs', jobRoutes);
  console.log('✅ Job routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading job routes:', error.message);
  console.error('Full error:', error);
}

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Test: https://jobtracked.onrender.com/api/health`);
});