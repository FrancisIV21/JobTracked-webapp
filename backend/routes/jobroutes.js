const express = require('express');
const router = express.Router();
const Job = require('../models/Jobs');

// GET all jobs with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new job
router.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE a job
router.delete('/:id', async (req, res) => {
  try {
    const result = await Job.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Batch delete
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await Job.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} jobs` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE job (PUT)
router.put('/:id', async (req, res) => {
  try {
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) return res.status(404).json({ error: 'Job not found' });
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH job (partial update)
router.patch('/:id', async (req, res) => {
  try {
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) return res.status(404).json({ error: 'Job not found' });
    res.json(updatedJob);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
