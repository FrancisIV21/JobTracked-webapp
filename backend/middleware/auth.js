const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  // Extract token from cookies, headers, or query
  const token = req.cookies?.token ||
              req.headers['authorization']?.replace('Bearer ', '') ||
              req.query?.token ||
              (req.get('X-Authorization') && req.get('X-Authorization').replace('Bearer ', ''));

  console.log('=== AUTHENTICATION MIDDLEWARE ===');
  console.log('Token found:', !!token);
  console.log('Token source:', 
    req.cookies?.token ? 'cookie' : 
    req.headers['authorization'] ? 'header' : 
    req.query?.token ? 'query' : 'none'
  );

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      ignoreExpiration: false
    });

    console.log('Token decoded successfully:', { id: decoded.id, email: decoded.email, provider: decoded.provider });

    // Find user by ID - IMPORTANT: Include the activeSessionToken field
    const user = await User.findById(decoded.id).select('+activeSessionToken').lean();
    
    if (!user) {
      console.log('User not found in database');
      if (req.cookies?.token) res.clearCookie('token');
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('User found:', { 
      id: user._id, 
      email: user.email, 
      provider: user.provider,
      hasActiveToken: !!user.activeSessionToken,
      sessionExpiry: user.sessionExpiry 
    });

    // For Google users, we're more lenient with session validation
    if (user.provider === 'google') {
      console.log('Google user - skipping session token validation');
      req.user = user;
      return next();
    }

    // For local users, check session token and expiry
    const now = new Date();
    const sessionExpiry = user.sessionExpiry ? new Date(user.sessionExpiry) : null;
    
    console.log('Local user session check:', {
      hasActiveToken: !!user.activeSessionToken,
      tokenMatches: user.activeSessionToken === token,
      sessionExpiry: sessionExpiry,
      currentTime: now,
      sessionValid: sessionExpiry && sessionExpiry > now
    });

    // Check if session token matches
    if (!user.activeSessionToken || user.activeSessionToken !== token) {
      console.log('Session token mismatch or missing');
      if (req.cookies?.token) res.clearCookie('token');
      return res.status(401).json({
        success: false,
        error: 'Invalid session token'
      });
    }

    // Check if session has expired
    if (sessionExpiry && sessionExpiry < now) {
      console.log('Session expired');
      if (req.cookies?.token) res.clearCookie('token');
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    console.log('Authentication successful');
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    // Clear invalid cookie
    if (req.cookies?.token) {
      res.clearCookie('token', { 
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
    }

    let errorMessage = 'Authentication failed';
    if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token';
    } else if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expired';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
};

const adminOnly = async (req, res, next) => {
  if (!req.user?.role) {
    if (logger && logger.warn) {
      logger.warn('Role check failed - no user role', {
        userId: req.user?.id,
        path: req.path
      });
    }
    return res.status(403).json({
      success: false,
      error: 'User role not detected',
      solution: 'Re-authenticate and try again'
    });
  }

  if (req.user.role !== 'admin') {
    if (logger && logger.warn) {
      logger.warn('Admin access denied', {
        userId: req.user.id,
        attemptedRole: req.user.role,
        requiredRole: 'admin'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Admin privileges required',
      solution: 'Contact system administrator'
    });
  }

  if (logger && logger.info) {
    logger.info(`Admin access granted to ${req.user.id}`);
  }
  next();
};

const requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized - no user role'
      });
    }

    if (req.user.role !== role) {
      if (logger && logger.warn) {
        logger.warn('Role access denied', {
          userId: req.user.id,
          has: req.user.role,
          requires: role
        });
      }
      return res.status(403).json({
        success: false,
        error: `Requires ${role} privileges`,
        currentRole: req.user.role,
        solution: 'Contact administrator for access'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  adminOnly,
  requireRole
};