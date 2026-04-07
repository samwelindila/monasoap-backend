const router = require('express').Router();
const ContactMessage = require('../models/ContactMessage');
const auth = require('../middleware/auth');

// POST message (public)
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const contact = await ContactMessage.create({ name, email, message });
    res.status(201).json({ message: 'Message sent successfully!', contact });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all messages (admin)
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark as read (admin)
router.put('/:id/read', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id, { isRead: true }, { new: true }
    );
    res.json(message);
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
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;