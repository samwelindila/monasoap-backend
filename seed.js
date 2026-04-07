const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected...');

    // Check if admin already exists
    const exists = await User.findOne({ role: 'admin' });
    if (exists) {
      console.log('Admin already exists. No action taken.');
      process.exit();
    }

    // Hash the password
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    // Create admin user
    await User.create({
      name: 'MonaSoap Admin',
      email: process.env.ADMIN_EMAIL,
      password: hashed,
      phone: '+255700000000',
      whatsapp: '+255700000000',
      address: 'Dar es Salaam',
      location: 'Dar es Salaam, Tanzania',
      role: 'admin'
    });

    console.log('✅ Admin account created successfully!');
    console.log(`📧 Email: ${process.env.ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD}`);
    console.log('You can now log in as admin.');
    process.exit();
  })
  .catch(err => {
    console.log('❌ Error:', err.message);
    process.exit(1);
  });