const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove money from a user\'s balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove money from')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of money to remove')
        .setRequired(true)
    ),
  async execute(interaction) {
    const authorId = interaction.user.id;
    const allowedUserId = '961788342163349574'; // Replace with the allowed user ID

    if (authorId !== allowedUserId) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ You do not have permission to use this command.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (!targetUser || amount <= 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ Invalid command usage. Please mention a user and provide a valid amount.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const targetUserId = targetUser.id;
    const user = await User.findOne({ userId: targetUserId });

    if (!user || user.balance < amount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ ${targetUser.username} does not have enough balance to remove ${currencyFormatter.format(amount, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    user.balance -= amount;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`✅ Removed ${currencyFormatter.format(amount, { code: 'USD' })} from ${targetUser.username}'s balance.`);

    interaction.reply({ embeds: [embed] });
  },
};