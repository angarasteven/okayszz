const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward and get rich! 💰'),

  async execute(interaction) {
    const userId = interaction.user.id;
    let user = await User.findOne({ userId });

    if (!user) {
      user = new User({ userId });
      await user.save();
    }

    const currentTime = Date.now();
    const nextDailyReward = user.lastDailyReward + 86400000; // 24 hours in milliseconds

    if (currentTime < nextDailyReward) {
      const timeRemaining = Math.floor((nextDailyReward - currentTime) / 1000 / 60 / 60); // Convert to hours
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setDescription(`⏰ You have already claimed your daily reward! Come back in ${timeRemaining} hours to claim your next reward. 🕰️`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const dailyReward = Math.floor(Math.random() * 3001);
    const formattedReward = currencyFormatter.format(dailyReward, { code: 'USD' });
    user.balance += dailyReward;
    user.lastDailyReward = currentTime;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Daily Reward Claimed! 🎉')
      .setDescription(`💰 You have claimed your daily reward of ${formattedReward}! Your new balance is ${currencyFormatter.format(user.balance, { code: 'USD' })}. 💸`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  },
};