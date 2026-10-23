require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Database connected');
    console.log('Base utilisée :', mongoose.connection.name);
  })
  .catch(error => console.error('MongoDB connection error:', error.message));

module.exports = mongoose;