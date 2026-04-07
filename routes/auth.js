const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register customer
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      whatsapp,
      address,
      location
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: 'Name, email, password and phone are required'
      });
    }

    // Check if email already exists
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create customer
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      phone,
      whatsapp: whatsapp || phone,
      address: address || '',
      location: location || '',
      role: 'customer'
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        whatsapp: user.whatsapp,
        address: user.address,
        location: user.location
      }
    });

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Login (admin + customer same route)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        whatsapp: user.whatsapp,
        address: user.address,
        location: user.location
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

