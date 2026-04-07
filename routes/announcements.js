const router = require('express').Router();
const Announcement = require('../models/Announcement');
const auth = require('../middleware/auth');

// GET active announcements (public)
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all announcements (admin)
router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const announcements = await Announcement.find()
      .sort({ order: 1, createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE (admin)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const announcement = await Announcement.create(req.body);
    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE (admin)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    );
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE (admin)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;