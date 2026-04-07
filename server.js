const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

const app = express();

// Configure multer for file uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.use(cors({
  origin: [
    "https://monasoap.netlify.app",
    "http://localhost:3000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== SETTINGS MODEL ==========
const settingsSchema = new mongoose.Schema({
  lipaNumber: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  location: { type: String, default: '' },
  locationMapUrl: { type: String, default: '' },
  facebook: { type: String, default: '' },
  instagram: { type: String, default: '' },
  twitter: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  aboutUs: { type: String, default: '' },
  aboutUsImage: { type: String, default: '' },
  siteName: { type: String, default: 'MonaSoap' },
  siteDescription: { type: String, default: 'Natural Handcrafted Soaps' },
  contactEmail: { type: String, default: 'info@monasoap.com' },
  contactPhone: { type: String, default: '255770374380' },
  address: { type: String, default: 'Dar es Salaam, Tanzania' },
  deliveryFee: { type: Number, default: 3000 },
  freeDeliveryThreshold: { type: Number, default: 50000 },
  currency: { type: String, default: 'TZS' },
  primaryColor: { type: String, default: '#5a3e2b' },
  secondaryColor: { type: String, default: '#c9a96e' },
  logoUrl: { type: String, default: '' },
  socialMedia: {
    facebook: { type: String, default: 'https://facebook.com/monasoap' },
    instagram: { type: String, default: 'https://instagram.com/monasoap' },
    whatsapp: { type: String, default: 'https://wa.me/255770374380' }
  }
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

// ========== ANNOUNCEMENT MODEL ==========
const announcementSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const Announcement = mongoose.model('Announcement', announcementSchema);

// Helper: get or create the single settings document
async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
    console.log('⚙️ Default settings created in MongoDB');
  }
  return settings;
}

// ========== SETTINGS ROUTES ==========
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', upload.single('aboutUsImage'), async (req, res) => {
  try {
    console.log('=== UPDATE SETTINGS REQUEST ===');
    let updateData = {};

    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON data format' });
      }
    } else {
      updateData = { ...req.body };
    }

    if (req.file) {
      updateData.aboutUsImage = req.file.filename;
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(updateData);
    } else {
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== '__v') {
          settings[key] = updateData[key];
        }
      });
    }

    await settings.save();
    console.log('✅ Settings saved to MongoDB');

    res.json({
      success: true,
      message: 'Settings updated successfully',
      ...settings.toObject()
    });
  } catch (error) {
    console.error('Error updating settings:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update settings: ' + error.message });
  }
});

// ========== ANNOUNCEMENTS ROUTES (DATABASE VERSION) ==========

// GET all announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ order: 1, createdAt: -1 });
    console.log(`📢 Fetched ${announcements.length} announcements`);
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET all announcements (alias for /all endpoint)
app.get('/api/announcements/all', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ order: 1, createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// CREATE new announcement
app.post('/api/announcements', async (req, res) => {
  try {
    const { text, isActive, order } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Announcement text is required' });
    }
    
    const newAnnouncement = new Announcement({
      text: text.trim(),
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });
    
    await newAnnouncement.save();
    console.log(`✅ Announcement created: "${newAnnouncement.text.substring(0, 50)}"`);
    
    res.json({
      success: true,
      message: 'Announcement created successfully',
      announcement: newAnnouncement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

// UPDATE announcement
app.put('/api/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, isActive, order } = req.body;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    if (text !== undefined) announcement.text = text.trim();
    if (isActive !== undefined) announcement.isActive = isActive;
    if (order !== undefined) announcement.order = order;
    
    await announcement.save();
    console.log(`✅ Announcement updated: ${id}`);
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
});

// PATCH announcement (for partial updates like toggling status)
app.patch('/api/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v') {
        announcement[key] = updates[key];
      }
    });
    
    await announcement.save();
    console.log(`✅ Announcement patched: ${id}`);
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('Error patching announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
});

// DELETE announcement
app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    console.log(`✅ Announcement deleted: ${id}`);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
});

// ========== EXISTING ROUTES ==========
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Loaded route: /api/auth');
} catch (err) { console.log('⚠️ Auth route not found'); }

try {
  app.use('/api/products', require('./routes/products'));
  console.log('✅ Loaded route: /api/products');
} catch (err) { console.log('⚠️ Products route not found'); }

try {
  app.use('/api/orders', require('./routes/orders'));
  console.log('✅ Loaded route: /api/orders');
} catch (err) { console.log('⚠️ Orders route not found'); }

// ========== REVIEWS ROUTES ==========
// ========== REVIEWS ROUTES (MongoDB) ==========
const Review = require('./models/Review');
const User = require('./models/User');
const auth = require('./middleware/auth');

// GET all reviews (for homepage display)
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET reviews for a specific product
app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('customer', 'name')   // ← THIS is what pulls the name
      .sort({ createdAt: -1 });

    const safeReviews = reviews.map(r => {
      const obj = r.toObject();
      if (!obj.customer) obj.customer = { name: 'Customer' };
      if (!obj.customer.name) obj.customer.name = 'Customer';
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

// POST a new review (requires login)
app.post('/api/reviews', auth, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already reviewed this product
    const existing = await Review.findOne({
      customer: req.user.id,
      product: productId
    });

    if (existing) {
      return res.status(400).json({ message: 'You already reviewed this product' });
    }

    // Optional: check if user ordered the product
    // const Order = require('./models/Order');
    // const ordered = await Order.findOne({
    //   customer: req.user.id,
    //   'products.product': productId,
    //   status: 'delivered'
    // });
    // if (!ordered) return res.status(403).json({ message: 'You can only review products you have received' });

    const review = await Review.create({
      customer: req.user.id,   // ← saves the real user ID
      product: productId,
      rating: Number(rating),
      comment
    });

    // Populate name before sending back
    await review.populate('customer', 'name');

    console.log(`✅ New review added for product ${productId}: ${rating} stars by ${review.customer?.name}`);
    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET review summary for a product
app.get('/api/reviews/product/:productId/summary', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId });
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    res.json({ productId: req.params.productId, averageRating: avgRating, totalReviews: reviews.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE review (admin only)
app.delete('/api/reviews/:id', auth, async (req, res) => {
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
// ========== CONTACT MESSAGES ROUTES ==========
let contactMessages = [
  { _id: '1', name: 'Jane Doe', email: 'jane@example.com', phone: '255712345678', message: 'I love your soaps! Do you have wholesale prices?', createdAt: new Date().toISOString(), status: 'unread' },
  { _id: '2', name: 'John Smith', email: 'john@example.com', phone: '255765432109', message: 'When will you restock the Lavender soap?', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'read' }
];

app.get('/api/contact', async (req, res) => {
  try { res.json(contactMessages); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch contact messages' }); }
});

app.get('/api/contact/:id', async (req, res) => {
  try {
    const message = contactMessages.find(m => m._id === req.params.id);
    message ? res.json(message) : res.status(404).json({ error: 'Message not found' });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch contact message' }); }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    console.log(`📧 New contact message from ${name} (${email}): ${message}`);
    const newMessage = { _id: Date.now().toString(), name, email, phone, message, createdAt: new Date().toISOString(), status: 'unread' };
    contactMessages.unshift(newMessage);
    res.json({ success: true, message: 'Thank you for your message! We will get back to you soon.', data: newMessage });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' }); }
});

app.put('/api/contact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const index = contactMessages.findIndex(m => m._id === id);
    if (index !== -1) {
      contactMessages[index].status = status || 'read';
      res.json({ success: true, message: `Message ${id} updated successfully` });
    } else { res.status(404).json({ error: 'Message not found' }); }
  } catch (error) { res.status(500).json({ error: 'Failed to update contact message' }); }
});

app.put('/api/contact/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const index = contactMessages.findIndex(m => m._id === id);
    if (index !== -1) {
      contactMessages[index].status = 'read';
      console.log(`📧 Message ${id} marked as read`);
      res.json({ success: true, message: `Message ${id} marked as read` });
    } else { res.status(404).json({ error: 'Message not found' }); }
  } catch (error) { res.status(500).json({ error: 'Failed to mark message as read' }); }
});

app.put('/api/contact/:id/unread', async (req, res) => {
  try {
    const { id } = req.params;
    const index = contactMessages.findIndex(m => m._id === id);
    if (index !== -1) {
      contactMessages[index].status = 'unread';
      console.log(`📧 Message ${id} marked as unread`);
      res.json({ success: true, message: `Message ${id} marked as unread` });
    } else { res.status(404).json({ error: 'Message not found' }); }
  } catch (error) { res.status(500).json({ error: 'Failed to mark message as unread' }); }
});

app.delete('/api/contact/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    const deletedCount = contactMessages.filter(m => ids.includes(m._id)).length;
    contactMessages = contactMessages.filter(m => !ids.includes(m._id));
    console.log(`📧 Bulk deleted ${deletedCount} messages`);
    res.json({ success: true, message: `${deletedCount} messages deleted successfully` });
  } catch (error) { res.status(500).json({ error: 'Failed to delete messages' }); }
});

app.delete('/api/contact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const initialLength = contactMessages.length;
    contactMessages = contactMessages.filter(m => m._id !== id);
    if (contactMessages.length < initialLength) {
      res.json({ success: true, message: `Message ${id} deleted successfully` });
    } else { res.status(404).json({ error: 'Message not found' }); }
  } catch (error) { res.status(500).json({ error: 'Failed to delete contact message' }); }
});

// ========== AI CHATBOT ==========
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY is not set in .env');
      return res.status(500).json({ reply: 'Chatbot is not configured. Please contact support.' });
    }

    console.log(`💬 AI chat request — ${messages.length} message(s)`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are Mona, a warm and knowledgeable soap assistant for MonaSoap. Keep responses concise (2–4 sentences max). Use a single relevant emoji per message.`,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('❌ Anthropic API error:', errData);
      return res.status(500).json({ reply: 'Samahani, I am having trouble right now. Please WhatsApp us: https://wa.me/255613374380 🌿' });
    }

    const data = await response.json();
    const reply = data?.content?.map(b => b.text || '').join('')
      || 'Samahani, please reach out on WhatsApp: https://wa.me/255613374380';

    console.log(`✅ AI reply sent: ${reply.substring(0, 80)}...`);
    res.json({ reply });

  } catch (error) {
    console.error('❌ Chatbot error:', error.message);
    res.status(500).json({
      reply: 'Pole! Something went wrong. Please WhatsApp us at https://wa.me/255613374380 💚'
    });
  }
});

// ========== TEST ENDPOINTS ==========
app.get('/api/chat/test', (req, res) => {
  res.json({
    status: 'AI Chatbot is ready!',
    aiEnabled: !!process.env.ANTHROPIC_API_KEY,
    port: process.env.PORT || 5000
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ========== ROOT ROUTE ==========
app.get('/', (req, res) => {
  res.json({
    message: 'MonaSoap API is running...',
    endpoints: {
      chat: '/api/chat',
      products: '/api/products',
      orders: '/api/orders',
      auth: '/api/auth',
      announcements: '/api/announcements',
      settings: '/api/settings',
      contact: '/api/contact',
      reviews: '/api/reviews'
    }
  });
});

// ========== DATABASE CONNECTION ==========
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📋 Settings API: http://localhost:${PORT}/api/settings`);
        console.log(`📢 Announcements: http://localhost:${PORT}/api/announcements`);
        console.log(`⭐ Reviews: http://localhost:${PORT}/api/reviews`);
        console.log(`📧 Contact: http://localhost:${PORT}/api/contact`);
        console.log(`🤖 AI Chatbot: http://localhost:${PORT}/api/chat`);
        console.log(`🔑 Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ MISSING'}`);
      });
    })
    .catch(err => console.log('❌ MongoDB error:', err.message));
} else {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('⚠️ MONGO_URI not set - using in-memory storage only');
  });
}