const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const config = require('../config');
const { sendMagicLink } = require('../services/emailService'); // Optional for magic links

// ======= GENERATE MAGIC LINK =======
exports.requestLogin = async (req, res) => {
  const { email } = req.body;

  try {
    // Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail });
    const isNewUser = !user;

    if (isNewUser) {
      user = new User({
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        provider: 'email'
      });
    }

    // Check for existing active session
    if (user.hasActiveSession()) {
      return res.status(409).json({
        error: 'Active session exists',
        solution: 'Check your email for existing login link'
      });
    }

    // Generate token and save session
    const token = user.createSession();
    await user.save();

    // OPTIONAL: Send magic link via email
    if (process.env.NODE_ENV === 'production') {
      await sendMagicLink(email, token);
      return res.status(200).json({
        message: 'Login link sent to your email',
        expiresIn: '15 minutes' // Token expiry time
      });
    }

    // Development response (returns token directly)
    res.status(200).json({
      message: isNewUser ? 'Account created' : 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ======= VERIFY SESSION =======
exports.verifySession = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.hasActiveSession()) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    res.status(200).json({
      isValid: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Session verification failed' });
  }
};

// ======= LOGOUT =======
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.clearSession();
    await user.save();

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};
exports.verifyGoogleToken = async (req, res) => {
  try {
    const token = req.cookies?.token || req.query.token;
    if (!token) throw new Error('No token provided');

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) throw new Error('User not found');

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        provider: user.provider
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid Google token'
    });
  }
};