// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');

// ✅ Use memory storage - upload to Cloudinary manually
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per file
});

// ✅ Accept BOTH 'images' and 'videos' fields from the form
const uploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 3 }
]);

// ✅ Upload a single file buffer to Cloudinary
const uploadToCloudinary = (buffer, mimetype, isVideo = false) => {
  return new Promise((resolve, reject) => {
    const resourceType = isVideo ? 'video' : 'image';
    const folder = isVideo ? 'monasoap-products-videos' : 'monasoap-products';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        ...(!isVideo && {
          transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        })
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result.secure_url); // ✅ full https:// URL
      }
    );

    uploadStream.end(buffer);
  });
};

// ✅ Delete a file from Cloudinary by URL
const deleteFromCloudinary = async (url, resourceType = 'image') => {
  try {
    if (!url || !url.startsWith('http')) return;
    const urlParts = url.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex === -1) return;
    const withVersion = urlParts.slice(uploadIndex + 1);
    const withoutVersion =
      withVersion[0].startsWith('v') && /^v\d+$/.test(withVersion[0])
        ? withVersion.slice(1)
        : withVersion;
    const publicId = withoutVersion.join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`🗑️ Deleted: ${publicId}`);
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
router.post('/', uploadFields, async (req, res) => {
  try {
    console.log(`📦 Creating product: ${req.body.name}`);

    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    console.log(`🖼️ Image files: ${imageFiles.length}, 🎥 Video files: ${videoFiles.length}`);

    // Upload images to Cloudinary
    const imageUrls = await Promise.all(
      imageFiles.map(f => uploadToCloudinary(f.buffer, f.mimetype, false))
    );

    // Upload videos to Cloudinary
    const videoUrls = await Promise.all(
      videoFiles.map(f => uploadToCloudinary(f.buffer, f.mimetype, true))
    );

    const qty = parseInt(req.body.quantity) || 0;
    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      category: req.body.category,
      quantity: qty,
      images: imageUrls,
      videos: videoUrls,
      isAvailable: qty > 0
    });

    await product.save();
    console.log(`✅ Product created: ${product.name}`);
    console.log(`🖼️ Images:`, imageUrls);
    console.log(`🎥 Videos:`, videoUrls);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message });
  }
});

// ──────────────────────────────────────────
// UPDATE product
// ──────────────────────────────────────────
router.put('/:id', uploadFields, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    console.log(`📦 Updating product: ${product.name}`);

    // Update text fields
    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.price !== undefined) product.price = parseFloat(req.body.price);
    if (req.body.category !== undefined) product.category = req.body.category;
    if (req.body.quantity !== undefined) {
      product.quantity = parseInt(req.body.quantity);
      product.isAvailable = product.quantity > 0;
    }

    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    // If new images uploaded → delete old + replace
    if (imageFiles.length > 0) {
      for (const url of product.images || []) {
        await deleteFromCloudinary(url, 'image');
      }
      product.images = await Promise.all(
        imageFiles.map(f => uploadToCloudinary(f.buffer, f.mimetype, false))
      );
      console.log(`🖼️ Images updated:`, product.images);
    }

    // If new videos uploaded → delete old + replace
    if (videoFiles.length > 0) {
      for (const url of product.videos || []) {
        await deleteFromCloudinary(url, 'video');
      }
      product.videos = await Promise.all(
        videoFiles.map(f => uploadToCloudinary(f.buffer, f.mimetype, true))
      );
      console.log(`🎥 Videos updated:`, product.videos);
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
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype, false);
    res.json({ success: true, imageUrl: url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;