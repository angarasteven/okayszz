const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob coins from another user')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user you want to rob')
        .setRequired(true)
    ),
  async execute(interaction) {
    const robber = await User.findOne({ userId: interaction.user.id });
    const targetUser = interaction.options.getUser('target');
    const target = await User.findOne({ userId: targetUser.id });

    if (!robber || !target) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ Either you or the target user does not have an account in the economy.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (robber.balance < 500) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ You need at least 500 coins in your balance to attempt a robbery.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (target.balance < 500) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ ${targetUser.username} doesn't have enough coins to make it worth robbing.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const robberBalance = robber.balance;
    const targetBalance = target.balance;
    const maxRobberyAmount = Math.floor(targetBalance * 0.25); // Maximum amount that can be robbed (25% of target's balance)
    const robberyAmount = Math.floor(Math.random() * maxRobberyAmount) + 1; // Random amount between 1 and maxRobberyAmount

    const successChance = Math.floor(Math.random() * 100); // Random number between 0 and 99
    const successRate = Math.floor((robberBalance / (robberBalance + targetBalance)) * 100); // Success rate based on the balance ratio

    if (successChance <= successRate) {
      // Successful robbery
      robber.balance += robberyAmount;
      target.balance -= robberyAmount;
      await robber.save();
      await target.save();

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`🔫 You successfully robbed ${currencyFormatter.format(robberyAmount, { code: 'USD' })} from ${targetUser.username}! Your new balance is ${currencyFormatter.format(robber.balance, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed] });
    } else {
      // Failed robbery
      const lossAmount = Math.floor(robberBalance * 0.1); // 10% of the robber's balance is lost
      robber.balance -= lossAmount;
      await robber.save();

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`🚔 Your robbery attempt on ${targetUser.username} failed! You lost ${currencyFormatter.format(lossAmount, { code: 'USD' })}. Your new balance is ${currencyFormatter.format(robber.balance, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed] });
    }
  },
};
