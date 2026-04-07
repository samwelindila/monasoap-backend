const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  lipaNumber: { type: String, default: '' },
  instagram: { type: String, default: '' },
  facebook: { type: String, default: '' },
  twitter: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  location: { type: String, default: '' },
  locationMapUrl: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  aboutUs: { type: String, default: '' },
  aboutUsImage: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);