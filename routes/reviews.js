const router = require('express').Router();
const Review = require('../models/Review');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// POST review
router.post('/', auth, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;

    const ordered = await Order.findOne({
      customer: req.user.id,
      'products.product': productId,
      status: 'delivered'
    });

    if (!ordered) {
      return res.status(403).json({
        message: 'You can only review products you have received'
      });
    }

    const existing = await Review.findOne({
      customer: req.user.id,
      product: productId
    });

    if (existing) {
      return res.status(400).json({ message: 'You already reviewed this product' });
    }

    const review = await Review.create({
      customer: req.user.id,
      product: productId,
      rating,
      comment
    });

    await review.populate('customer', 'name email');
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET reviews for a product
router.get('/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('customer', 'name email')  // <-- added email as fallback
      .sort({ createdAt: -1 });

    // Sanitize: ensure every review has a safe customer object
    const safeReviews = reviews.map(r => {
      const obj = r.toObject();
      if (!obj.customer || !obj.customer.name) {
        obj.customer = { name: 'Customer', ...obj.customer };
      }
      return obj;
    });

    const avgRating = safeReviews.length
      ? (safeReviews.reduce((sum, r) => sum + r.rating, 0) / safeReviews.length).toFixed(1)
      : 0;

    res.json({ reviews: safeReviews, avgRating, total: safeReviews.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE review (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;