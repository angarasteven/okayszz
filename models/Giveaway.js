const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  prize: {
    type: { type: String, required: true, enum: ['money', 'item'] },
    value: { type: Number, required: true },
    name: { type: String },
  },
  endTime: { type: Number, required: true },
  participants: [{ type: String }],
  winnerId: { type: String },
});

const Giveaway = mongoose.model('Giveaway', giveawaySchema);

module.exports = Giveaway;
