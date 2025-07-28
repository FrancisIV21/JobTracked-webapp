const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const passport = require('passport');
const { signup, login } = require('../controllers/authController');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here';

// ======================
// Generate JWT Token
// ======================
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
router.post('/signup', signup);
router.post('/login', login);

// ======================
// EMAIL/PASSWORD SIGNUP
// ======================
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    const token = generateToken(newUser);
    res.status(201).json({ token, user: { email: newUser.email } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================
// EMAIL/PASSWORD LOGIN
// ======================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user);
    res.status(200).json({ token, user: { email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================
// GOOGLE OAUTH INIT
// ======================
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// ======================
// GOOGLE OAUTH CALLBACK
// ======================
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:5000/pages/JobTrackerDashboard.html',
  }),
  (req, res) => {
    const user = req.user;
    const token = generateToken(user);

    // You can send token in query string or save it in localStorage later
    const redirectUrl = `http://localhost:5000/pages/JobTrackerDashboard.html?token=${token}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&profilePicture=${encodeURIComponent(user.profilePicture || '')}&provider=google`;

    res.redirect(redirectUrl);
  }
);

// ======================
// GOOGLE LOGIN FAILURE
// ======================
router.get('/google/failure', (req, res) => {
  res.status(401).send('❌ Google login failed.');
});

// ======================
// DEBUG USER SESSION
// ======================
router.get('/debug/user', (req, res) => {
  res.json(req.user || { msg: 'No user in session' });
});

module.exports = router;
