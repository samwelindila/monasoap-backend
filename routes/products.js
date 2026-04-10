// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');

// ✅ Storage config for IMAGES
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'monasoap-products',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

// ✅ Storage config for VIDEOS
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'monasoap-products-videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  }
});

// ✅ Custom multer storage that routes to image or video storage based on mimetype
const combinedStorage = {
  _handleFile(req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      videoStorage._handleFile(req, file, cb);
    } else {
      imageStorage._handleFile(req, file, cb);
    }
  },
  _removeFile(req, file, cb) {
    if (file.mimetype.startsWith('video/')) {
      videoStorage._removeFile(req, file, cb);
    } else {
      imageStorage._removeFile(req, file, cb);
    }
  }
};

const upload = multer({
  storage: combinedStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per file
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

// ✅ Helper: separate uploaded files into images and videos
const separateFiles = (files) => {
  const images = [];
  const videos = [];
  if (files && files.length > 0) {
    for (const file of files) {
      if (file.mimetype && file.mimetype.startsWith('video/')) {
        videos.push(file.path); // full Cloudinary URL
      } else {
        images.push(file.path); // full Cloudinary URL
      }
    }
  }
  return { images, videos };
};

// CREATE product with image and video uploads
router.post('/', upload.array('images', 10), async (req, res) => {
  try {
    const { images, videos: uploadedVideos } = separateFiles(req.files);

    // Also accept video URLs passed as strings in body
    let bodyVideos = [];
    if (req.body.videos) {
      try {
        bodyVideos = typeof req.body.videos === 'string'
          ? JSON.parse(req.body.videos)
          : req.body.videos;
      } catch { bodyVideos = []; }
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      category: req.body.category,
      quantity: parseInt(req.body.quantity) || 0,
      images: images,
      videos: [...uploadedVideos, ...bodyVideos],
      isAvailable: (parseInt(req.body.quantity) || 0) > 0
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

// UPDATE product with optional new images/videos
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Update text fields
    if (req.body.name) product.name = req.body.name;
    if (req.body.description) product.description = req.body.description;
    if (req.body.price) product.price = parseFloat(req.body.price);
    if (req.body.category) product.category = req.body.category;
    if (req.body.quantity !== undefined) {
      product.quantity = parseInt(req.body.quantity);
      product.isAvailable = product.quantity > 0;
    }

    // If new files were uploaded
    if (req.files && req.files.length > 0) {
      const { images: newImages, videos: newVideos } = separateFiles(req.files);

      // Delete old images from Cloudinary and replace
      if (newImages.length > 0) {
        if (product.images && product.images.length > 0) {
          for (const oldUrl of product.images) {
            try {
              const publicId = extractPublicId(oldUrl);
              if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
            } catch (err) {
              console.error('Error deleting old image:', err);
            }
          }
        }
        product.images = newImages;
      }

      // Delete old videos from Cloudinary and replace
      if (newVideos.length > 0) {
        if (product.videos && product.videos.length > 0) {
          for (const oldUrl of product.videos) {
            try {
              const publicId = extractPublicId(oldUrl);
              if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
            } catch (err) {
              console.error('Error deleting old video:', err);
            }
          }
        }
        product.videos = newVideos;
      }
    }

    // Update videos from body if provided and no files uploaded
    if (req.body.videos && (!req.files || req.files.length === 0)) {
      try {
        product.videos = typeof req.body.videos === 'string'
          ? JSON.parse(req.body.videos)
          : req.body.videos;
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

// DELETE product (and delete images/videos from Cloudinary)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const url of product.images) {
        try {
          const publicId = extractPublicId(url);
          if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }

    // Delete videos from Cloudinary
    if (product.videos && product.videos.length > 0) {
      for (const url of product.videos) {
        try {
          const publicId = extractPublicId(url);
          if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        } catch (err) {
          console.error('Error deleting video:', err);
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

// Single image upload endpoint
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

// ✅ Helper: extract Cloudinary public_id from full URL
function extractPublicId(url) {
  try {
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1) return null;
    const withVersion = urlParts.slice(uploadIndex + 1);
    const withoutVersion = withVersion[0].startsWith('v') && /^v\d+$/.test(withVersion[0])
      ? withVersion.slice(1)
      : withVersion;
    return withoutVersion.join('/').replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

module.exports = router;