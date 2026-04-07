const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'on_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentNote: { type: String, default: '' },
  deliveryAddress: { type: String },
  orderedAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  receiptGenerated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);