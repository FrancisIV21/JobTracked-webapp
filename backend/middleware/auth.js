// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '45825c8000e0c4d59b26cde960ffa6beb6d946047ad7537c19967b35e36c9280469a45d92948881b040c85dc165b677edfff267319e59b50261f9595244db5cd';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    req.userId = user.userId; // userId encoded in the token
    next();
  });
}

module.exports = authenticateToken;
