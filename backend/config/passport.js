const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User = require('../models/User');
const logger = require('../utils/logger');

// Session Serialization
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user._id || user.id);
  done(null, user._id || user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user ID:', id);
    const user = await User.findById(id).select('-activeSessionToken');
    console.log('Deserialized user:', user ? user.email : 'not found');
    done(null, user || null);
  } catch (err) {
    logger.error('Deserialization failed:', err);
    done(err, null);
  }
});

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL}/api/auth/google/callback`,
  scope: ['profile', 'email'],
  passReqToCallback: false, // Simplified - remove req parameter unless needed
  proxy: true
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth callback triggered for profile:', profile.id);
    
    if (!profile.emails?.[0]?.value) {
      console.error('No email provided by Google for profile:', profile.id);
      throw new Error('No email provided by Google');
    }

    const email = profile.emails[0].value.toLowerCase().trim();
    const picture = profile.photos?.[0]?.value?.replace('sz=50', 'sz=300');
    
    console.log('Processing Google OAuth for email:', email);

    // Check if user already exists
    let user = await User.findOne({
      $or: [
        { googleId: profile.id },
        { email: email }
      ]
    });

    if (user) {
      console.log('Existing user found:', user.email);
      
      // Update existing user with Google info if not already set
      const updateData = {
        googleId: profile.id,
        name: profile.displayName || user.name || email.split('@')[0],
        profilePicture: picture || user.profilePicture,
        provider: 'google',
        verified: true,
        lastLogin: new Date()
      };

      // Only update if something changed
      let hasChanges = false;
      for (const [key, value] of Object.entries(updateData)) {
        if (user[key] !== value) {
          hasChanges = true;
          user[key] = value;
        }
      }

      if (hasChanges) {
        await user.save();
        console.log('Updated existing user with Google data');
      }
    } else {
      console.log('Creating new user for email:', email);
      
      // Create new user
      user = new User({
        googleId: profile.id,
        email: email,
        name: profile.displayName || email.split('@')[0],
        profilePicture: picture,
        provider: 'google',
        verified: true,
        role: 'user',
        lastLogin: new Date()
      });

      await user.save();
      console.log('Created new user:', user.email);
    }

    logger.info(`Google auth success: ${user.email} (ID: ${user._id})`);
    console.log('Returning user to passport callback');
    
    done(null, user);
  } catch (err) {
    logger.error('Google OAuth failure:', {
      error: err.message,
      stack: err.stack,
      profileId: profile?.id,
      email: profile?.emails?.[0]?.value
    });
    console.error('Google OAuth error:', err);
    done(err, null);
  }
}));

// Add error handling for strategy
passport.use('google-verify', new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL}/api/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  // This is a backup strategy for verification
  try {
    const user = await User.findOne({ googleId: profile.id });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

module.exports = passport;