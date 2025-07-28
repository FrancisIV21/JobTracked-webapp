const express = require('express');
const router = express.Router();
const User = require('../models/User');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const validator = require('validator');

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
    const user = new User({ email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
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

    res.status(200).json({ message: 'Login successful' });
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
    failureRedirect: '/pages/JobTrackerLogin.html', // redirect to your login page on failure
  }),
  (req, res) => {
    const user = req.user;

    // ✅ Updated to redirect to the correct PORT: 5000
    const redirectUrl = `/pages/JobTrackerDashboard.html?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&profilePicture=${encodeURIComponent(user.profilePicture || '')}&provider=google`;

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
// DEBUG SESSION
// ======================
router.get('/debug/user', (req, res) => {
  res.json(req.user || { msg: 'No user in session' });
});

module.exports = router;
