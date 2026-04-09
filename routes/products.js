// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');

// Configure Cloudinary storage for products (supports multiple files)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'monasoap-products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

// Configure multer for multiple images (max 5)
const upload = multer({ 
  storage: storage,
  limits: { files: 5 }
});

// GET all products (with optional search and category filters)
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};
    
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }
    if (category && category.trim()) {
      query.category = category;
    }
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: error.message });
  }
});

// CREATE product with multiple image uploads
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    // Get Cloudinary URLs for all uploaded images
    const imageUrls = req.files ? req.files.map(file => file.path) : [];
    
    // Get video URLs from request body (if any)
    let videoUrls = [];
    if (req.body.videos) {
      try {
        videoUrls = typeof req.body.videos === 'string' ? JSON.parse(req.body.videos) : req.body.videos;
      } catch {
        videoUrls = [];
      }
    }
    
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      category: req.body.category,
      quantity: parseInt(req.body.quantity) || 0,
      images: imageUrls,  // Array of Cloudinary URLs
      videos: videoUrls,  // Array of video URLs/paths
      isAvailable: (parseInt(req.body.quantity) || 0) > 0
    };
    
    const product = new Product(productData);
    await product.save();
    
    console.log(`✅ Product created: ${product.name} with ${imageUrls.length} image(s)`);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message });
  }
});

// UPDATE product with optional new images
router.put('/:id', upload.array('images', 5), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    // Update text fields
    if (req.body.name) product.name = req.body.name;
    if (req.body.description) product.description = req.body.description;
    if (req.body.price) product.price = parseFloat(req.body.price);
    if (req.body.category) product.category = req.body.category;
    if (req.body.quantity) {
      product.quantity = parseInt(req.body.quantity);
      product.isAvailable = product.quantity > 0;
    }
    
    // Update videos if provided
    if (req.body.videos) {
      try {
        product.videos = typeof req.body.videos === 'string' ? JSON.parse(req.body.videos) : req.body.videos;
      } catch (err) {
        console.error('Error parsing videos:', err);
      }
    }
    
    // If new images were uploaded
    if (req.files && req.files.length > 0) {
      // Optional: Delete old images from Cloudinary
      if (product.images && product.images.length > 0) {
        for (const oldImageUrl of product.images) {
          try {
            // Extract public ID from Cloudinary URL
            const publicId = oldImageUrl.split('/').slice(-2).join('/').split('.')[0];
            await cloudinary.uploader.destroy(publicId);
            console.log(`🗑️ Deleted old image: ${publicId}`);
          } catch (err) {
            console.error('Error deleting old image:', err);
          }
        }
      }
      
      // Set new images
      product.images = req.files.map(file => file.path);
    }
    
    await product.save();
    console.log(`✅ Product updated: ${product.name}`);
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE product (and delete images from Cloudinary)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    // Delete all images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const imageUrl of product.images) {
        try {
          // Extract public ID from Cloudinary URL
          const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
          console.log(`🗑️ Deleted image from Cloudinary: ${publicId}`);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }
    
    await product.deleteOne();
    console.log(`✅ Product deleted: ${product.name}`);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optional: Endpoint for single image upload (for settings/about page)
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    res.json({
      success: true,
      imageUrl: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;