const express = require('express');
const router = express.Router();
const Job = require('../models/Jobs');
const authenticateToken = require('../middleware/auth'); // 👈 use centralized middleware

// GET all jobs for the logged-in user (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { userId: req.userId }; // From token

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { company: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
      ];
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Create a new job for the user
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!req.body.company || !req.body.position) {
      return res.status(400).json({ error: 'Company and Position are required.' });
    }

    const job = new Job({
      ...req.body,
      userId: req.userId,
    });

    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE - Delete a job by ID (owned by user)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Job.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!deleted) return res.status(404).json({ error: 'Job not found or not authorized' });

    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BATCH DELETE - Delete multiple jobs owned by the user
router.post('/batch-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No job IDs provided.' });
    }

    const result = await Job.deleteMany({
      _id: { $in: ids },
      userId: req.userId,
    });

    res.json({ message: `Deleted ${result.deletedCount} jobs` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - Full update for a job (owned by user)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updatedJob = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) return res.status(404).json({ error: 'Job not found or not authorized' });

    res.json(updatedJob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH - Partial update for a job (owned by user)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const updatedJob = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) return res.status(404).json({ error: 'Job not found or not authorized' });

    res.json(updatedJob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
