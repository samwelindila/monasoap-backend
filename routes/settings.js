const router = require('express').Router();
const Settings = require('../models/settings');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// ================= GET SETTINGS =================
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
      console.log('⚙️ Default settings created');
    }

    res.json(settings);
  } catch (err) {
    console.error('GET settings error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ================= UPDATE SETTINGS =================
router.put('/', auth, upload.single('aboutUsImage'), async (req, res) => {
  try {
    // 🔐 Admin check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    console.log('=== Request received ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    let settingsData = {};

    // ✅ Handle FormData JSON string
    if (req.body.data) {
      try {
        settingsData = JSON.parse(req.body.data);
      } catch (e) {
        console.error('JSON parse error:', e.message);
        return res.status(400).json({ message: 'Invalid data format' });
      }
    } else {
      settingsData = { ...req.body };
    }

    delete settingsData.data;

    // ✅ Add image if uploaded
    if (req.file) {
      settingsData.aboutUsImage = req.file.filename;
    }

    console.log('Settings to save:', settingsData);

    // Save or update
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings(settingsData);
    } else {
      Object.assign(settings, settingsData);
    }

    await settings.save();

    console.log('✅ Settings saved successfully');

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });

  } catch (err) {
    console.error('❌ Error saving settings:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;