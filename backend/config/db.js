  const mongoose = require('mongoose');

  const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.error('❌ MongoDB connection URI is missing');
      process.exit(1);
    }

    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      });
      
      console.log('✅ MongoDB connected successfully');
      console.log(`Connected to database: ${mongoose.connection.name}`);
      
      mongoose.connection.on('connected', () => {
        console.log('Mongoose default connection open');
      });

      mongoose.connection.on('error', (err) => {
        console.error('Mongoose connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('Mongoose default connection disconnected');
      });

      // Close connection on app termination
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
      });

    } catch (err) {
      console.error('❌ MongoDB connection failed:', err.message);
      console.log('Connection URI used:', mongoUri.replace(/:[^:@]+@/, ':********@'));
      process.exit(1);
    }
  };

  module.exports = connectDB;