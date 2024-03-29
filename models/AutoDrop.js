const mongoose = require('mongoose');

const autoDropSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  dropAmount: { type: Number, required: true },
  dropFrequency: { type: Number, required: true },
  lastDropTime: { type: Number, default: 0 },
  intervalId: { type: Number }, // Add this line
});

const AutoDrop = mongoose.model('AutoDrop', autoDropSchema);

module.exports = AutoDrop;