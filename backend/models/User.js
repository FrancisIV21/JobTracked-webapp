const mongoose = require('mongoose');
const validator = require('validator');

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
    unique: true,
    sparse: true // allows both Google and manual users
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address']
  },
  password: {
    type: String,
    // required only if not using Google login
    validate: {
      validator: function (value) {
        // Only require password if user is not using Google login
        return this.googleId || (value && value.length >= 6);
      },
      message: 'Password must be at least 6 characters long'
    }
  },
  name: String,
  image: String
});

module.exports = mongoose.model('User', UserSchema);
