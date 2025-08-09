require('dotenv').config();

module.exports = {
  // JWT (what auth middleware expects)
  JWT_SECRET: process.env.JWT_SECRET,
  
  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_URL: process.env.BACKEND_URL,
  
  // Google OAuth (flat structure for easier access)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET, 
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  
  // Legacy nested structure (keep for compatibility)
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL
  },
  
  // Database
  DB_URI: process.env.MONGODB_URI,
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI, // Support both names
  
  // Additional configs your middleware might need
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000
};