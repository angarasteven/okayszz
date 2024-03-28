const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  prize: { type: Number, required: true },
  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
});

const Giveaway = mongoose.model('Giveaway', giveawaySchema);

module.exports = Giveaway;
