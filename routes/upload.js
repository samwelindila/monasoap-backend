// In your backend (Express.js)
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (use your env variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Set up Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'monasoap-products', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const upload = multer({ storage: storage });

// Your upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    // Cloudinary automatically returns the URL
    const imageUrl = req.file.path; // This is the Cloudinary URL
    const publicId = req.file.filename;
    
    res.json({
      success: true,
      imageUrl: imageUrl,  // Save this URL to your database
      publicId: publicId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});