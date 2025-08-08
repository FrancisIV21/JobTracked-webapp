const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Invalid email address']
  },
  profilePicture: {
    type: String,
    default: ''
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows null for non-Google users
  },
  activeSessionToken: {
    type: String,
    default: null,
    select: false
  },
  sessionExpiry: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.activeSessionToken;
      delete ret.__v;
      delete ret.googleId;
      return ret;
    }
  }
});

// ======================
// Instance Methods
// ======================
userSchema.methods.generateToken = function() {
  // Fixed: Use 'id' instead of 'userId' to match auth middleware expectations
  return jwt.sign(
    {
      id: this._id,          // Changed from userId to id
      email: this.email,
      provider: this.provider
    },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

userSchema.methods.createSession = function() {
  const token = this.generateToken();
  this.activeSessionToken = token;
  this.sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  this.lastLogin = new Date();
  return token;
};

userSchema.methods.clearSession = function() {
  this.activeSessionToken = null;
  this.sessionExpiry = null;
};

userSchema.methods.hasActiveSession = function() {
  return this.activeSessionToken && this.sessionExpiry && new Date(this.sessionExpiry) > new Date();
};

userSchema.methods.toAuthJSON = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    profilePicture: this.profilePicture,
    provider: this.provider,
    verified: this.verified,
    role: this.role
  };
};

// ======================
// Static Methods
// ======================
userSchema.statics.findByToken = async function(token) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    // FIXED: Add select('+activeSessionToken') to include the field
    return this.findOne({
      _id: decoded.id,
      activeSessionToken: token,
      sessionExpiry: { $gt: new Date() }
    }).select('+activeSessionToken');
  } catch (err) {
    return null;
  }
};

userSchema.statics.findOrCreateGoogleUser = async function(profile) {
  const email = profile.emails[0].value.toLowerCase().trim();
 
  return await this.findOneAndUpdate(
    { $or: [{ googleId: profile.id }, { email }] },
    {
      $set: {
        googleId: profile.id,
        email,
        name: profile.displayName,
        profilePicture: profile.photos[0]?.value.replace('sz=50', 'sz=200'),
        provider: 'google',
        verified: true,
        lastLogin: new Date()
      },
      $setOnInsert: {
        role: 'user'
      }
    },
    {
      new: true,
      upsert: true
    }
  );
};

// ======================
// Middleware
// ======================
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);