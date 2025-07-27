const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');

const connectDB = require('./config/db');
const jobroutes = require('./routes/jobroutes');
const authroutes = require('./routes/authroutes'); // updated route name

dotenv.config();

// Connect to DB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Session Middleware (must come before passport)
app.use(session({
  secret: 'keyboard cat', // 🔐 use env var in production
  resave: false,
  saveUninitialized: false
}));

// Passport Middleware
require('./config/passport'); // Load passport config
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api/jobs', jobroutes);
app.use('/api/auth', authroutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
