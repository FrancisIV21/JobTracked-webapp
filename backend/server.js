require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const path = require('path'); // 🆕 Needed for file paths

const connectDB = require('./config/db');
const jobroutes = require('./routes/jobroutes');
const authroutes = require('./routes/authroutes');

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
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// 🆕 Serve static frontend files
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));

// 🆕 Route to serve HTML pages from /frontend/pages
app.get('/pages/:pageName', (req, res) => {
  const pageFile = path.join(frontendPath, 'pages', req.params.pageName);
  res.sendFile(pageFile, (err) => {
    if (err) {
      res.status(404).send('Page not found.');
    }
  });
});

// 🆕 Optional: Redirect root to the dashboard
app.get('/', (req, res) => {
  res.redirect('/pages/JobTrackerDashboard.html');
});

// API Routes
app.use('/api/jobs', jobroutes);
app.use('/api/auth', authroutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
