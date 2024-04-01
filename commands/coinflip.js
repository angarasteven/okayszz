const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const MIN_BET = 100; // Minimum bet amount
const MAX_BET = 10000; // Maximum bet amount
const COOLDOWN_DURATION = 7000; // 7 seconds cooldown
const STREAK_MULTIPLIER = 1.2; // 20% bonus for each consecutive win
const DEFAULT_WIN_CHANCE = 43; // Default winning chance

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
      return interaction.reply(`The bet amount should be between ${currencyFormatter.format(MIN_BET, { code: 'USD' })} and ${currencyFormatter.format(MAX_BET, { code: 'USD' })}.`);
    }

    // Check if the user is on cooldown
    if (this.cooldowns.has(userId)) {
      const cooldownExpiration = this.cooldowns.get(userId);
      const remainingCooldown = cooldownExpiration - Date.now();
      if (remainingCooldown > 0) {
        return interaction.reply(`You're on cooldown for ${Math.ceil(remainingCooldown / 1000)} more seconds. ⏰`);
      }
    }

    // Get the user's balance
    const user = await User.findOne({ userId });
    const userBalance = user.balance;

    // Check if the user has enough balance
    if (userBalance < amount) {
      return interaction.reply(`You don't have enough money to make this bet. Your current balance is ${currencyFormatter.format(userBalance, { code: 'USD' })}. 💰`);
    }

    // Flip the coin
    const result = Math.random() < DEFAULT_WIN_CHANCE / 100 ? choice : choice === 'heads' ? 'tails' : 'heads';
    const won = result === choice;

    // Update the user's balance and streak
    let streak = this.streaks.get(userId) || 0;
    let multiplier = 1;
    if (won) {
      streak++;
      multiplier = STREAK_MULTIPLIER ** streak;
    } else {
      streak = 0;
    }
    this.streaks.set(userId, streak);

    const payout = won ? amount * multiplier : -amount;
    await User.updateOne({ userId }, { $inc: { balance: payout } });

    // Set a cooldown for the user
    this.cooldowns.set(userId, Date.now() + COOLDOWN_DURATION);

    // Send the result to the user
    const embedColor = won ? 0x00FF00 : 0xFF0000;
    const embedDescription = `You ${won ? 'won 🎉' : 'lost 😢'} ${currencyFormatter.format(Math.abs(payout), { code: 'USD' })}! The result was ${result}.`;
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setDescription(embedDescription)
      .addFields(
        { name: 'Your Balance', value: `${currencyFormatter.format(userBalance + payout, { code: 'USD' })} 💰`, inline: true },
        { name: 'Streak', value: `${streak} 🔥`, inline: true },
        { name: 'Multiplier', value: `${multiplier}x 💎`, inline: true }
      );
    interaction.reply({ embeds: [embed] });
  }
};
