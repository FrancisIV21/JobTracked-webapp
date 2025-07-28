const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'interview', 'declined', 'accepted'],
    default: 'pending',
  },
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
