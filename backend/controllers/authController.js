const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_here'; // make sure to set in .env

// ======= SIGNUP =======
exports.signup = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already in use.' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({ email, password: hashedPassword });

    // Generate JWT
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Signup successful',
      token,
      user: {
        id: newUser._id,
        email: newUser.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during signup.' });
  }
};

// ======= LOGIN =======
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
};
