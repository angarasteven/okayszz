const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const MIN_BET = 100; // Minimum bet amount
const MAX_BET = 10000; // Maximum bet amount
const COOLDOWN_DURATION = 10000; // 10 seconds cooldown
const STREAK_MULTIPLIER = 1.2; // 20% bonus for each consecutive win

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and try your luck! 🪙')
    .addStringOption(option =>
      option
        .setName('choice')
        .setDescription('Choose heads or tails')
        .setRequired(true)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of money to bet')
        .setRequired(true)
    ),
  cooldowns: new Map(),
  streaks: new Map(),

  async execute(interaction) {
    const userId = interaction.user.id;
    const choice = interaction.options.getString('choice');
    const amount = interaction.options.getInteger('amount');

    // Check if the bet amount is within the allowed range
    if (amount < MIN_BET || amount > MAX_BET) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ The bet amount should be between ${currencyFormatter.format(MIN_BET, { code: 'USD' })} and ${currencyFormatter.format(MAX_BET, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if the user is on cooldown
    const cooldownEntry = this.cooldowns.get(userId);
    if (cooldownEntry && cooldownEntry > Date.now()) {
      const timeRemaining = (cooldownEntry - Date.now()) / 1000; // Convert to seconds
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ You're on cooldown! Please wait ${timeRemaining.toFixed(1)} seconds before using this command again.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = await User.findOne({ userId });

    if (!user || user.balance < amount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ You don't have enough balance to bet ${currencyFormatter.format(amount, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const winningChance = 0.3; // 30% chance of winning
    const isWin = Math.random() < winningChance;
    const result = isWin ? 'heads' : 'tails';

    let multiplier = 1; // Default multiplier
    let streak = this.streaks.get(userId) || 0; // Get the user's current streak

    if (isWin && choice === result) {
      streak++;
      multiplier = Math.pow(STREAK_MULTIPLIER, streak); // Apply streak multiplier
    } else {
      streak = 0;
    }

    this.streaks.set(userId, streak); // Update the user's streak

    let embed = new EmbedBuilder()
      .setColor(isWin && choice === result ? 0x00FF00 : 0xFF0000)
      .setTitle(isWin && choice === result ? '🎉 You won! 🎉' : '😔 You lost... 😔')
      .setDescription(`🪙 The coin landed on ${result === 'heads' ? '👑 Heads' : '🐍 Tails'}!${isWin && choice === result ? ` You won ${currencyFormatter.format(amount * multiplier, { code: 'USD' })}!` : ' Better luck next time!'}`);

    if (isWin && choice === result) {
      user.balance += amount * multiplier;
      await user.save();
      embed = new EmbedBuilder(embed)
        .addFields({ name: 'New Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` });
      interaction.reply({ embeds: [embed] });
    } else {
      user.balance -= amount;
      await user.save();
      embed = new EmbedBuilder(embed)
        .addFields({ name: 'New Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` });
      interaction.reply({ embeds: [embed] });
    }

    // Set the cooldown for the user
    const cooldownExpiration = Date.now() + COOLDOWN_DURATION;
    this.cooldowns.set(userId, cooldownExpiration);
  },
};
