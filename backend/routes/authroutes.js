const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');

// JWT generator - consistent with User model
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      provider: user.provider
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

router.get('/get-token', authenticate, async (req, res) => {
  try {
    // Generate a new token for the authenticated user
    const token = generateToken(req.user);
    
    res.json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Get token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate token'
    });
  }
});

// ======= GOOGLE OAUTH: INITIATE =======
router.get('/google', (req, res, next) => {
  console.log('=== GOOGLE OAUTH INITIATE ===');
  console.log('Query params:', req.query);
  console.log('Session ID:', req.sessionID);
  
  // Store return URL in session if provided
  if (req.query.returnTo) {
    req.session.returnTo = req.query.returnTo;
    console.log('Stored returnTo in session:', req.query.returnTo);
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    accessType: 'offline'
  })(req, res, next);
});

// ======= GOOGLE OAUTH: CALLBACK =======
router.get('/google/callback', (req, res, next) => {
  console.log('=== GOOGLE OAUTH CALLBACK RECEIVED ===');
  console.log('Query params:', req.query);
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  
  passport.authenticate('google', {
    session: true,
    failureFlash: false
  }, async (err, user, info) => {
    console.log('=== PASSPORT CALLBACK RESULT ===');
    console.log('Error:', err);
    console.log('User:', user ? { id: user._id, email: user.email } : null);
    console.log('Info:', info);

    if (err) {
      console.error('Google OAuth authentication error:', err);
      console.error('Error stack:', err.stack);
      return res.redirect(`${process.env.FRONTEND_URL}/JobTrackerSignUp.html?error=auth_failed&details=${encodeURIComponent(err.message)}`);
    }

    if (!user) {
      console.error('No user returned from Google OAuth');
      console.error('Passport info:', info);
      return res.redirect(`${process.env.FRONTEND_URL}/JobTrackerSignUp.html?error=no_user`);
    }

    try {
      console.log('=== PROCESSING SUCCESSFUL AUTH ===');
      console.log('User from passport:', {
        id: user._id,
        email: user.email,
        provider: user.provider,
        googleId: user.googleId
      });

      // Check if JWT_SECRET is available
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Generate JWT token
      console.log('Generating JWT token...');
      const token = generateToken(user);
      console.log('Token generated successfully, length:', token.length);
      
      // Get fresh user from database to ensure we can save
      console.log('Fetching fresh user from database...');
      const freshUser = await User.findById(user._id);
      if (!freshUser) {
        throw new Error('User not found in database after authentication');
      }
      
      console.log('Fresh user found:', freshUser.email);

      // Clear existing session if method exists
      if (typeof freshUser.clearSession === 'function') {
        console.log('Clearing existing session...');
        freshUser.clearSession();
      } else {
        console.log('clearSession method not available, manually clearing...');
        freshUser.activeSessionToken = undefined;
        freshUser.sessionExpiry = undefined;
      }
      
      // Set new session data
      console.log('Setting new session data...');
      freshUser.activeSessionToken = token;
      freshUser.sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      freshUser.lastLogin = new Date();

      // Save user
      console.log('Saving user to database...');
      await freshUser.save();
      console.log('User saved successfully');

      // Set HTTP-only cookie
      console.log('Setting HTTP-only cookie...');
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      console.log('Cookie set successfully');

      // Establish session
      console.log('Establishing user session...');
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Session login error:', loginErr);
          console.error('Login error stack:', loginErr.stack);
          return res.redirect(`${process.env.FRONTEND_URL}/JobTrackerSignUp.html?error=session_error&details=${encodeURIComponent(loginErr.message)}`);
        }

        console.log('Session established successfully');
        console.log('Session after login:', req.session);

        // Get return URL
        const returnTo = req.session.returnTo || '/JobTrackerDashboard.html';
        console.log('Return URL:', returnTo);
        
        if (req.session.returnTo) {
          delete req.session.returnTo;
        }
        
        // Create redirect URL with token
        const redirectUrl = `${process.env.FRONTEND_URL}${returnTo}#token=${token}`;
        console.log('Final redirect URL:', redirectUrl);
        
        console.log('=== GOOGLE AUTH COMPLETED SUCCESSFULLY ===');
        res.redirect(redirectUrl);
      });

    } catch (error) {
      console.error('=== GOOGLE AUTH PROCESSING ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('User data at error:', user ? { id: user._id, email: user.email } : 'null');
      
      // More specific error redirect
      const errorType = error.message.includes('JWT_SECRET') ? 'config_error' :
                       error.message.includes('database') ? 'db_error' :
                       error.message.includes('save') ? 'save_error' : 'server_error';
      
      res.redirect(`${process.env.FRONTEND_URL}/JobTrackerSignUp.html?error=${errorType}&details=${encodeURIComponent(error.message)}`);
    }
  })(req, res, next);
});

// ======= EMAIL LOGIN (PASSWORDLESS/MAGIC) =======
router.post('/login', async (req, res) => {
  try {
    console.log('=== EMAIL LOGIN ATTEMPT ===');
    const { email } = req.body;
    console.log('Email:', email);

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);
    
    let user = await User.findOne({ email: normalizedEmail });
    console.log('Existing user found:', !!user);

    if (!user) {
      console.log('Creating new user...');
      user = new User({
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        provider: 'local',
        verified: true // Set to true for local email users
      });
      await user.save();
      console.log('New user created:', user._id);
    }

    // For local login, check for active sessions (optional - you might want to allow multiple sessions)
    if (user.hasActiveSession && user.hasActiveSession()) {
      console.log('User has active session, clearing it...');
      // Instead of rejecting, clear the existing session and create a new one
      user.clearSession();
    }

    console.log('Generating token for user...');
    // Use the User model's method to ensure consistency
    const token = user.createSession();
    await user.save();
    console.log('Token created and user saved');

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log('Cookie set, sending response...');
    res.json({
      success: true,
      token,
      redirect: `${process.env.FRONTEND_URL}/JobTrackerDashboard.html`,
      user: user.toAuthJSON()
    });
    console.log('=== EMAIL LOGIN SUCCESS ===');

  } catch (error) {
    console.error('=== EMAIL LOGIN ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Authentication service unavailable',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// ======= SESSION VERIFICATION =======
router.get('/verify', authenticate, async (req, res) => {
  try {
    console.log('=== SESSION VERIFICATION ===');
    console.log('User from middleware:', req.user ? { id: req.user._id || req.user.id, email: req.user.email } : null);
    
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found, sending verification response');
    res.json({
      isValid: true,
      user: user.toAuthJSON()
    });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'Session verification failed' });
  }
});

// ======= LOGOUT =======
router.post('/logout', authenticate, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    
    if (user && user.clearSession) {
      user.clearSession();
      await user.save();
    }

    res.clearCookie('token', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    // Also destroy the session if using sessions
    if (req.session && req.session.destroy) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;