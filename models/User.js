const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  whatsapp: { type: String },
  address: { type: String },
  location: { type: String },
  role: { type: String, enum: ['admin', 'customer'], default: 'customer' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);