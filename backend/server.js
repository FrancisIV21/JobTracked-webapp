// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
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

// CORS - allow frontend (Vercel) + local dev
const allowedOrigins = [
  'http://localhost:5501', // local dev
  'https://jobtracked-euuf6sl0q-francisiv21s-projects.vercel.app' // production frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));

// =======================
// Sessions & Passport
// =======================
app.set('trust proxy', 1); // needed for secure cookies on Render

app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in prod for HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// =======================
// API Routes
// =======================
app.use('/api/auth', authroutes);
app.use('/api/jobs', jobroutes);

// Health check (optional)
app.get('/', (req, res) => {
  res.send('Backend is running ✅');
});

// =======================
// Database Connection
// =======================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
