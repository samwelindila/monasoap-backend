// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');

// ✅ Use memory storage - we'll upload to Cloudinary manually
// This lets us handle images and videos differently
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// ✅ Upload a single file buffer to Cloudinary
const uploadToCloudinary = (buffer, mimetype, folder) => {
  return new Promise((resolve, reject) => {
    const isVideo = mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder || (isVideo ? 'monasoap-products-videos' : 'monasoap-products'),
        resource_type: resourceType,
        ...(isVideo ? {} : {
          transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        })
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url); // ✅ always returns full https:// URL
      }
    );

    uploadStream.end(buffer);
  });
};

// ✅ Upload all files and separate into images/videos
const uploadFiles = async (files) => {
  const images = [];
  const videos = [];

  if (!files || files.length === 0) return { images, videos };

  for (const file of files) {
    try {
      const url = await uploadToCloudinary(file.buffer, file.mimetype);
      if (file.mimetype.startsWith('video/')) {
        videos.push(url);
      } else {
        images.push(url);
      }
    } catch (err) {
      console.error(`❌ Failed to upload ${file.originalname}:`, err.message);
    }
  }

  return { images, videos };
};

// ✅ Delete a file from Cloudinary by URL
const deleteFromCloudinary = async (url, resourceType = 'image') => {
  try {
    if (!url || !url.startsWith('http')) return;
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1) return;
    const withVersion = urlParts.slice(uploadIndex + 1);
    const withoutVersion = withVersion[0].startsWith('v') && /^v\d+$/.test(withVersion[0])
      ? withVersion.slice(1)
      : withVersion;
    const publicId = withoutVersion.join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
  } catch (err) {
    console.error('Error deleting from Cloudinary:', err.message);
  }
};

// ──────────────────────────────────────────
// GET all products
// ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};
    if (search && search.trim()) query.name = { $regex: search.trim(), $options: 'i' };
    if (category && category.trim()) query.category = category;
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────
// GET single product
// ──────────────────────────────────────────
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

// ──────────────────────────────────────────
// CREATE product
// ──────────────────────────────────────────
router.post('/', upload.array('images', 10), async (req, res) => {
  try {
    console.log(`📦 Creating product: ${req.body.name}`);
    console.log(`📁 Files received: ${req.files?.length || 0}`);

    // Upload all files to Cloudinary
    const { images, videos: uploadedVideos } = await uploadFiles(req.files);

    // Also accept video URLs passed as strings in body
    let bodyVideos = [];
    if (req.body.videos) {
      try {
        bodyVideos = typeof req.body.videos === 'string'
          ? JSON.parse(req.body.videos)
          : Array.isArray(req.body.videos) ? req.body.videos : [];
      } catch { bodyVideos = []; }
    }

    const qty = parseInt(req.body.quantity) || 0;
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      category: req.body.category,
      quantity: qty,
      images,
      videos: [...uploadedVideos, ...bodyVideos],
      isAvailable: qty > 0
    };

    const product = new Product(productData);
    await product.save();

    console.log(`✅ Product created: ${product.name}`);
    console.log(`🖼️ Images (${images.length}):`, images);
    console.log(`🎥 Videos (${uploadedVideos.length}):`, uploadedVideos);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────
// UPDATE product
// ──────────────────────────────────────────
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    console.log(`📦 Updating product: ${product.name}`);
    console.log(`📁 Files received: ${req.files?.length || 0}`);

    // Update text fields
    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.price !== undefined) product.price = parseFloat(req.body.price);
    if (req.body.category !== undefined) product.category = req.body.category;
    if (req.body.quantity !== undefined) {
      product.quantity = parseInt(req.body.quantity);
      product.isAvailable = product.quantity > 0;
    }

    // If new files uploaded, delete old ones and replace
    if (req.files && req.files.length > 0) {
      const { images: newImages, videos: newVideos } = await uploadFiles(req.files);

      if (newImages.length > 0) {
        // Delete old images
        for (const url of product.images || []) {
          await deleteFromCloudinary(url, 'image');
        }
        product.images = newImages;
        console.log(`🖼️ Images updated (${newImages.length}):`, newImages);
      }

      if (newVideos.length > 0) {
        // Delete old videos
        for (const url of product.videos || []) {
          await deleteFromCloudinary(url, 'video');
        }
        product.videos = newVideos;
        console.log(`🎥 Videos updated (${newVideos.length}):`, newVideos);
      }
    }

    // Update videos from body if no files uploaded
    if (req.body.videos && (!req.files || req.files.length === 0)) {
      try {
        product.videos = typeof req.body.videos === 'string'
          ? JSON.parse(req.body.videos)
          : Array.isArray(req.body.videos) ? req.body.videos : product.videos;
      } catch (err) {
        console.error('Error parsing videos:', err);
      }
    }

    await product.save();
    console.log(`✅ Product updated: ${product.name}`);
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────
// DELETE product
// ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    for (const url of product.images || []) await deleteFromCloudinary(url, 'image');
    for (const url of product.videos || []) await deleteFromCloudinary(url, 'video');

    await product.deleteOne();
    console.log(`✅ Product deleted: ${product.name}`);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────
// Single file upload endpoint
// ──────────────────────────────────────────
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    res.json({ success: true, imageUrl: url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;