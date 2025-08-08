const express = require('express');
const router = express.Router();
const Job = require('../models/Jobs');
const { authenticate } = require('../middleware/auth');

// Get all jobs with optional filtering
router.post('/', authenticate, async (req, res) => {
  try {
    if (!req.body.company || !req.body.position) {
      return res.status(400).json({ 
        error: 'Both company and position are required',
        fields: ['company', 'position']
      });
    }

    const job = new Job({
      company: req.body.company.trim(),
      position: req.body.position.trim(),
      status: req.body.status || 'pending',
      userId: req.user._id
    });

    await job.save();
    
    res.status(201).json({
      success: true,
      job,
      message: 'Job created successfully'
    });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ 
      error: 'Failed to create job',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  }
});


router.get('/', authenticate, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user._id });
    res.json(jobs);
  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});



// Create new job
router.post('/', authenticate, async (req, res) => {
  try {
    if (!req.body.company || !req.body.position) {
      return res.status(400).json({ error: 'Company and Position are required' });
    }

    const job = new Job({
      ...req.body,
      userId: req.user.id
    });

    await job.save();
    res.status(201).json(job);
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Delete job by ID
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deleted = await Job.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Batch delete jobs
router.post('/batch-delete', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No job IDs provided' });
    }

    const result = await Job.deleteMany({
      _id: { $in: ids },
      userId: req.user.id
    });

    res.json({ message: `Deleted ${result.deletedCount} jobs` });
  } catch (err) {
    console.error('Batch delete error:', err);
    res.status(500).json({ error: 'Failed to delete jobs' });
  }
});

// Full update job
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updatedJob = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }

    res.json(updatedJob);
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Partial update job
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const updatedJob = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found or not authorized' });
    }

    res.json(updatedJob);
  } catch (err) {
    console.error('Patch job error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Error handling
router.use((err, req, res, next) => {
  console.error('Job route error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

module.exports = router;