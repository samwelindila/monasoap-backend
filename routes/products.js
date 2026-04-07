const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// GET all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single product (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE product (admin only)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 3 }
  ])(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { name, description, price, quantity, category } = req.body;
      const images = req.files['images']
        ? req.files['images'].map(f => f.filename)
        : [];
      const videos = req.files['videos']
        ? req.files['videos'].map(f => f.filename)
        : [];
      const product = await Product.create({
        name, description,
        price: Number(price),
        quantity: Number(quantity),
        category, images, videos,
        isAvailable: Number(quantity) > 0
      });
      res.status(201).json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
});

// UPDATE product (admin only)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 3 }
  ])(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { name, description, price, quantity, category } = req.body;
      const updateData = {
        name, description,
        price: Number(price),
        quantity: Number(quantity),
        category,
        isAvailable: Number(quantity) > 0
      };
      if (req.files['images']) {
        updateData.images = req.files['images'].map(f => f.filename);
      }
      if (req.files['videos']) {
        updateData.videos = req.files['videos'].map(f => f.filename);
      }
      const product = await Product.findByIdAndUpdate(
        req.params.id, updateData, { new: true }
      );
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
});

// DELETE product (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;