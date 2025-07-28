require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

const connectDB = require('./config/db');
const jobroutes = require('./routes/jobroutes');
const authroutes = require('./routes/authroutes');

const app = express();
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

// Session + Passport
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}));
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api/jobs', jobroutes);
app.use('/api/auth', authroutes);

// Serve frontend pages directly via /pages/:pageName
const frontendPath = path.join(__dirname, 'frontend');
app.get('/pages/:pageName', (req, res) => {
  const pageFile = path.join(frontendPath, 'pages', req.params.pageName);
  res.sendFile(pageFile, (err) => {
    if (err) {
      res.status(404).send('Page not found.');
    }
  });
});

// ✅ Default route: serve actual index.html from public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
