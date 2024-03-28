const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String },
  emoji: { type: String, default: '📦' },
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;