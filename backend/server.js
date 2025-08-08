require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');

const app = express();

// -- Logging Environment (Safe)
console.log('✅ Loading server with environment:', process.env.NODE_ENV);

// -- Check required env variables
const requiredEnvVars = {
  MONGO_URI: 'MongoDB URI is required',
  JWT_SECRET: 'JWT secret is required',
  GOOGLE_CLIENT_ID: 'Google Client ID is required',
  GOOGLE_CLIENT_SECRET: 'Google Client Secret is required'
};

Object.entries(requiredEnvVars).forEach(([key, error]) => {
  if (!process.env[key]) {
    console.error(`❌ ${error}`);
    process.exit(1);
  }
});

// -- Trust proxy (important for secure cookies if behind reverse proxy)
app.set('trust proxy', 1);

// -- Connect MongoDB
const connectDB = async () => {
  try {
    console.log('📡 Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn.connection.getClient(); // used by session store
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// -- Setup and start server
const startServer = async () => {
  const mongoClient = await connectDB();

  // -- Mongo session store
  const sessionStore = MongoStore.create({
    client: mongoClient,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  });

  // -- Middlewares
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // -- CORS with credentials
 app.use(cors({
  origin: ['http://localhost:5501', 'http://127.0.0.1:5501'],
  credentials: true
}));

  // -- Session setup
  app.use(session({
    secret: process.env.SESSION_SECRET || 'backup_session_secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  // -- Passport
  require('./config/passport');
  app.use(passport.initialize());
  app.use(passport.session());

  // -- Static (if any)
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // -- Routes
  const authRoutes = require('./routes/authroutes');
  const jobRoutes = require('./routes/jobroutes');

  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobRoutes);

  // -- Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // -- Production static site
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
  }

  // -- Error handler
  app.use((err, req, res, next) => {
    console.error('❌ [Unhandled Server Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  });

  // -- Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`
🚀 Server running on http://localhost:${PORT}
🌐 Frontend: ${process.env.FRONTEND_URL}
📦 MongoDB connected
🍪 Sessions via MongoStore
🔐 Google OAuth Ready
    `);
  });
};

startServer();
