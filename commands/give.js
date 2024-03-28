const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('💸 Give coins to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('🙍‍♂️ The user to give coins to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('💰 The amount of coins to give')
        .setRequired(true)
    ),

  async execute(interaction) {
    const sender = interaction.user;
    const recipient = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (sender.id === recipient.id) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ You cannot give coins to yourself, silly!');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const senderData = await User.findOne({ userId: sender.id });
    let recipientData = await User.findOne({ userId: recipient.id });

    if (!senderData || senderData.balance < amount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`💸 You don't have enough balance to give ${currencyFormatter.format(amount, { code: 'USD' })}. Go earn some more! 💰`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!recipientData) {
      recipientData = new User({ userId: recipient.id });
      await recipientData.save();
    }

    senderData.balance -= amount;
    recipientData.balance += amount;

    await senderData.save();
    await recipientData.save();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`✅ You have given ${currencyFormatter.format(amount, { code: 'USD' })} to ${recipient.username}! 🎉`);

    interaction.reply({ embeds: [embed] });
  },
};
