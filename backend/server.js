// server.js - STEP 2: Add Auth Routes
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use(cors({
  origin: [
    'http://localhost:5501',
    'https://jobtracked-euuf6sl0q-francisiv21s-projects.vercel.app',
    // Add your actual Vercel URL here - check your Vercel dashboard
    'https://jobtracked.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Add auth routes with detailed error handling
try {
  console.log('🔄 Loading auth routes...');
  const authroutes = require('./routes/authroutes');
  app.use('/api/auth', authroutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
  console.error('❌ Error stack:', error.stack);
}

// Add job routes with detailed error handling
try {
  console.log('🔄 Loading job routes...');
  const jobroutes = require('./routes/jobroutes');
  app.use('/api/jobs', jobroutes);
  console.log('✅ Job routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading job routes:', error.message);
  console.error('❌ Error stack:', error.stack);
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