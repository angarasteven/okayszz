const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: {
    name: 'balance',
    description: 'Check your current balance or another user\'s balance',
    options: [
      {
        name: 'user',
        type: 6, // USER option type
        description: 'The user whose balance you want to check',
        required: false, // Make it optional
      },
    ],
  },
  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') || interaction.user; // Get the target user or default to the command user

    const user = await User.findOne({ userId: targetUser.id });

    if (!user) {
      const newUser = new User({ userId: targetUser.id });
      await newUser.save();
      const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green color
        .setDescription(`🆕 Welcome to the economy system, ${targetUser.username}! Your current balance is 0 coins.`);
      return interaction.reply({ embeds: [embed] });
    }

    const formattedBalance = currencyFormatter.format(user.balance, { code: 'USD' });
    const embed = new EmbedBuilder()
      .setColor(0x0000FF) // Blue color
      .setTitle(`${targetUser.username}'s Balance`)
      .setDescription(`💰 ${targetUser.username}'s current balance is ${formattedBalance}.`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  },
};
