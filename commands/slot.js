const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');
const crypto = require('crypto');

const SLOT_SYMBOLS = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '⚫'];
const SYMBOL_MULTIPLIERS = {
  '🔴': 2, // Red
  '🟠': 2, // Orange
  '🟡': 2, // Yellow
  '🟢': 2, // Green
  '🔵': 2, // Blue
  '🟣': 2, // Purple
  '⚪': 2, // White
  '⚫': 2, // Black
};
const SLOT_ROWS = 3;
const SLOT_COLS = 3;
const MIN_BET = 100;
const MAX_BET = 10000;
const REWARD_MULTIPLIER = 3;
const COOLDOWN_DURATION = 35000; // 7 seconds
const STREAK_MULTIPLIER = 0.5; // 50% bonus for each consecutive win
const ANIMATION_DURATION = 5000; // 5 seconds

let winningChance = 0.5; // Initial winning chance
const cooldowns = new Map(); // Cooldown map for each user
const streaks = new Map(); // Streak map for each user

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Play the slot machine game!')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount of coins to bet')
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = await User.findOne({ userId: interaction.user.id });
    if (!user) return interaction.reply('You don\'t have an account yet. Use `/daily` to create one and get your starting balance.');

    const betAmount = interaction.options.getInteger('bet');
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      return interaction.reply(`The bet amount should be between ${currencyFormatter.format(MIN_BET, { code: 'COINS' })} and ${currencyFormatter.format(MAX_BET, { code: 'COINS' })}.`);
    }

    if (user.balance < betAmount) {
      return interaction.reply(`You don't have enough coins. Your balance is ${currencyFormatter.format(user.balance, { code: 'COINS' })}.`);
    }

    const cooldown = cooldowns.get(interaction.user.id);
    if (cooldown) {
      const remaining = (cooldown - Date.now()) / 1000;
      return interaction.reply(`You need to wait ${remaining.toFixed(1)} more second(s) before playing again.`);
    }

    const streak = streaks.get(interaction.user.id) || 0;
    const multiplier = 1 + (streak * STREAK_MULTIPLIER);

    const slots = generateSlots();
    const isWin = checkWin(slots);

    let rewardAmount = 0;
    if (isWin) {
      const winningSymbol = getWinningSymbol(slots);
      const symbolMultiplier = SYMBOL_MULTIPLIERS[winningSymbol];
      rewardAmount = betAmount * REWARD_MULTIPLIER * multiplier * symbolMultiplier;
      user.balance += rewardAmount;
      winningChance = Math.max(0.5, winningChance - 0.005); // Decrease winning chance by 0.5% on win
      streaks.set(interaction.user.id, streak + 1);
    } else {
      user.balance -= betAmount;
      winningChance = Math.min(0.64, winningChance + 0.01); // Increase winning chance by 1% on loss
      streaks.set(interaction.user.id, 0);
    }

    await user.save();
    cooldowns.set(interaction.user.id, Date.now() + COOLDOWN_DURATION);
    setTimeout(() => cooldowns.delete(interaction.user.id), COOLDOWN_DURATION);

    const animationEmbed = new EmbedBuilder()
      .setTitle('🎰 Slot Machine')
      .setDescription(renderSlots(slots));

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('spin')
          .setLabel('Spin')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

    const animationMessage = await interaction.reply({ embeds: [animationEmbed], components: [row] });

    // Simulate slot animation
    const animationInterval = setInterval(() => {
      const newSlots = generateSlots();
      const newAnimationEmbed = new EmbedBuilder()
        .setTitle('🎰 Slot Machine')
        .setDescription(renderSlots(newSlots));
      animationMessage.edit({ embeds: [newAnimationEmbed] });
    }, 500);

    setTimeout(() => {
      clearInterval(animationInterval);

      const resultEmbed = new EmbedBuilder()
        .setTitle('🎰 Slot Machine')
        .setDescription(renderSlots(slots))
        .addFields(
          { name: 'Bet Amount', value: `${currencyFormatter.format(betAmount, { code: 'COINS' })}`, inline: true },
          { name: 'Result', value: isWin ? `You won ${currencyFormatter.format(rewardAmount, { code: 'COINS' })}! ${getWinReason(slots)}` : 'You lost.', inline: true },
          { name: 'Balance', value: `${currencyFormatter.format(user.balance, { code: 'COINS' })}`, inline: true },
          { name: 'Winning Chance', value: `${(winningChance * 100).toFixed(2)}%`, inline: true },
          { name: 'Streak', value: `${streak}`, inline: true },
          { name: 'Multiplier', value: `${multiplier.toFixed(2)}x`, inline: true }
        );

      animationMessage.edit({ embeds: [resultEmbed], components: [] });
    }, ANIMATION_DURATION);
  },
};

function generateSlots() {
  const slots = [];
  for (let row = 0; row < SLOT_ROWS; row++) {
    const slotRow = [];
    for (let col = 0; col < SLOT_COLS; col++) {
      slotRow.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    }
    slots.push(slotRow);
  }
  return slots;
}

function renderSlots(slots) {
  let slotString = '';
  for (const row of slots) {
    slotString += row.join(' ') + '\n';
  }
  return slotString;
}

function checkWin(slots) {
  // Check rows
  for (const row of slots) {
    if (row.every(symbol => symbol === row[0])) {
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < SLOT_COLS; col++) {
    const column = slots.map(row => row[col]);
    if (column.every(symbol => symbol === column[0])) {
      return true;
    }
  }

  // Check diagonals
  const diagonal1 = [slots[0][0], slots[1][1], slots[2][2]];
  const diagonal2 = [slots[0][2], slots[1][1], slots[2][0]];
  if (diagonal1.every(symbol => symbol === diagonal1[0]) || diagonal2.every(symbol => symbol === diagonal2[0])) {
    return true;
  }

  // Check winning chance
  const randomValue = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
  return randomValue < winningChance;
}

function getWinningSymbol(slots) {
  // Check rows
  for (const row of slots) {
    if (row.every(symbol => symbol === row[0])) {
      return row[0];
    }
  }

  // Check columns
  for (let col = 0; col < SLOT_COLS; col++) {
    const column = slots.map(row => row[col]);
    if (column.every(symbol => symbol === column[0])) {
      return column[0];
    }
  }

  // Check diagonals
  const diagonal1 = [slots[0][0], slots[1][1], slots[2][2]];
  const diagonal2 = [slots[0][2], slots[1][1], slots[2][0]];
  if (diagonal1.every(symbol => symbol === diagonal1[0])) {
    return diagonal1[0];
  }
  if (diagonal2.every(symbol => symbol === diagonal2[0])) {
    return diagonal2[0];
  }

  // This should never happen, but return a default symbol just in case
  return '🔴';
}

function getWinReason(slots) {
  const winningSymbol = getWinningSymbol(slots);
  const symbolMultiplier = SYMBOL_MULTIPLIERS[winningSymbol];

  if (symbolMultiplier === 2) {
    return `You won with the ${winningSymbol} symbol, which has a 2x multiplier.`;
  } else {
    return `You won with the ${winningSymbol} symbol, which has a 2x multiplier.`;
  }
}
