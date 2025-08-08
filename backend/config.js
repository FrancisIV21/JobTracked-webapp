// backend/config.js
require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_URL: process.env.BACKEND_URL,
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL // Direct from env
  },
  DB_URI: process.env.MONGODB_URI
};