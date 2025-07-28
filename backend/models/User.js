const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare entered password with hashed
userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

// Generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign(
    { userId: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = mongoose.model('User', userSchema);
