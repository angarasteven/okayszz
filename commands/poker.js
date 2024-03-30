const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const MIN_BET = 100; // Minimum bet amount
const MAX_BET = 10000; // Maximum bet amount
const COOLDOWN_DURATION = 10000; // 10 seconds cooldown
const STREAK_MULTIPLIER = 1.2; // 20% bonus for each consecutive win
const WINNING_CHANCE = 0.48; // 48% chance of winning

// Function to create a card emoji
function createCardEmoji(rank, suit) {
  const suitEmojis = { '♣': '♠', '♦': '♦', '♥': '♥', '♠': '♠' };
  const rankEmojis = { '2': '2⃣', '3': '3⃣', '4': '4⃣', '5': '5⃣', '6': '6⃣', '7': '7⃣', '8': '8⃣', '9': '9⃣', 'T': '🃏', 'J': '🃑', 'Q': '🃕', 'K': '🃎', 'A': '🃁' };
  return `${rankEmojis[rank] || ''}${suitEmojis[suit]}`;
}

// Function to reveal cards with a delay
async function revealCards(interaction, playerCards, dealerCards) {
  const playerEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Your Cards');

  const dealerEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Dealer Cards');

  for (let i = 0; i < playerCards.length; i++) {
    playerEmbed.addField(`Card ${i + 1}`, createCardEmoji(playerCards[i].rank, playerCards[i].suit), true);
    dealerEmbed.addField(`Card ${i + 1}`, '🂠', true); // Hide dealer's cards initially

    await interaction.editReply({ embeds: [playerEmbed, dealerEmbed] });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay of 1 second
  }

  for (let i = 0; i < dealerCards.length; i++) {
    dealerEmbed.fields[i].value = createCardEmoji(dealerCards[i].rank, dealerCards[i].suit);
  }

  await interaction.editReply({ embeds: [playerEmbed, dealerEmbed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('Play a game of poker and try your luck! 🃏')
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

    const isWin = Math.random() < WINNING_CHANCE;

    let multiplier = 1; // Default multiplier
    let streak = this.streaks.get(userId) || 0; // Get the user's current streak

    if (isWin) {
      streak++;
      multiplier = Math.pow(STREAK_MULTIPLIER, streak); // Apply streak multiplier
    } else {
      streak = 0;
    }

    this.streaks.set(userId, streak); // Update the user's streak

    let embed = new EmbedBuilder()
      .setColor(isWin ? 0x00FF00 : 0xFF0000)
      .setTitle(isWin ? '🎉 You won! 🎉' : '😔 You lost... 😔')
      .setDescription(isWin ? `You won ${currencyFormatter.format(amount * multiplier, { code: 'USD' })}!` : 'Better luck next time!');

    if (isWin) {
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