const mongoose = require('mongoose');

const autoDropSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  interval: { type: Number, required: true },
  maxAmount: { type: Number, required: true },
  expirationTime: { type: Number, required: true },
  intervalId: { type: Number },
});

const AutoDrop = mongoose.model('AutoDrop', autoDropSchema);

module.exports = AutoDrop;