const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastDailyReward: { type: Number, default: 0 },
  lastWorkTime: { type: Number, default: 0 },
  jobLevel: {
    type: Object,
    default: {
      cashier: 1,
      programmer: 1,
      doctor: 1,
      lawyer: 1,
      ceo: 1
    }
  },
  textExperience: { type: Number, default: 0 },
  voiceExperience: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  requiredExperience: { type: Number, default: 100 },
  multiplier: {
    type: Object,
    default: {
      type: null,
      value: 1,
      expiresAt: null
    }
  },
  purchasedItems: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      category: { type: String },
      emoji: { type: String, default: '📦' },
      description: { type: String },
      type: { type: String, required: true, enum: ['regular', 'role'] },
      roleName: { type: String },
      roleColor: { type: String },
    },
  ],
});

const User = mongoose.model('User', userSchema);

module.exports = User;