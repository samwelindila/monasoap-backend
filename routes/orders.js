const router = require('express').Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// Place order (customer)
router.post('/', auth, async (req, res) => {
  try {
    const { products, deliveryAddress, paymentNote } = req.body;
    let totalAmount = 0;
    const orderProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (!product.isAvailable || product.quantity < item.quantity) {
        return res.status(400).json({
          message: `${product.name} is out of stock or insufficient quantity`
        });
      }
      product.quantity -= item.quantity;
      if (product.quantity === 0) product.isAvailable = false;
      await product.save();

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;
      orderProducts.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });
    }

    const order = await Order.create({
      customer: req.user.id,
      products: orderProducts,
      totalAmount,
      deliveryAddress,
      paymentNote,
      orderedAt: new Date()
    });

    await order.populate('customer', 'name phone whatsapp');
    await order.populate('products.product', 'name price');
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET customer own orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user.id })
      .populate('products.product', 'name price images')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sales report (admin only)
router.get('/reports/sales', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const { period } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '6months':
        startDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const orders = await Order.find({
      createdAt: { $gte: startDate },
      status: { $ne: 'cancelled' }
    })
      .populate('customer', 'name phone')
      .populate('products.product', 'name');

    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const onDelivery = orders.filter(o => o.status === 'on_delivery').length;

    res.json({
      period,
      totalSales,
      totalOrders,
      delivered,
      pending,
      onDelivery,
      orders
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all orders (admin only)
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;
    const orders = await Order.find(query)
      .populate('customer', 'name phone whatsapp address location')
      .populate('products.product', 'name price')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE order status (admin only)
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  try {
    const { status } = req.body;
    const updateData = { status };
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      updateData.receiptGenerated = true;
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('customer', 'name phone')
     .populate('products.product', 'name price');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE order (customer only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET receipt (customer - delivered orders only)
router.get('/:id/receipt', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone whatsapp address location')
      .populate('products.product', 'name price category');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isOwner = order.customer._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        message: 'Receipt only available for delivered orders'
      });
    }

    res.json({
      receipt: {
        receiptNumber: `REC-${order._id.toString().slice(-8).toUpperCase()}`,
        orderId: order._id,
        deliveredAt: order.deliveredAt
          ? new Date(order.deliveredAt).toLocaleString('en-TZ', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
            })
          : 'N/A',
        orderDate: new Date(order.createdAt).toLocaleString('en-TZ', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        }),
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          whatsapp: order.customer.whatsapp,
          address: order.customer.address,
          location: order.customer.location
        },
        deliveryAddress: order.deliveryAddress,
        products: order.products.map(item => ({
          name: item.product?.name || 'Product',
          category: item.product?.category || '',
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity
        })),
        totalAmount: order.totalAmount,
        paymentNote: order.paymentNote,
        status: order.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;