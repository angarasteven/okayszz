const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const slotEmojis = ['🍒', '🍋', '🍊', '🍇', '🍓', '🍍', '🍌', '🍉'];
const fruitMultipliers = {
  '🍒': 4, // Cherry (x4 multiplier)
  '🍋': 3, // Lemon (x3 multiplier)
  '🍊': 3, // Orange (x3 multiplier)
  '🍇': 2, // Grapes (x2 multiplier)
  '🍓': 2, // Strawberry (x2 multiplier)
  '🍍': 2, // Pineapple (x2 multiplier)
  '🍌': 2, // Banana (x2 multiplier)
  '🍉': 2, // Watermelon (x2 multiplier)
};
const paylines = [
  [0, 1, 2], // Horizontal
  [3, 4, 5], // Horizontal
  [6, 7, 8], // Horizontal
  [0, 3, 6], // Vertical
  [1, 4, 7], // Vertical
  [2, 5, 8], // Vertical
  [0, 4, 8], // Diagonal
  [2, 4, 6], // Diagonal
];
const MIN_BET = 100; // Minimum bet amount
const MAX_BET = 10000; // Maximum bet amount
const COOLDOWN_DURATION = 10000; // 10 seconds cooldown
const SPIN_DURATION = 3000; // 3 seconds for spinning animation
const JACKPOT_CHANCE = 0.01; // 1% chance of hitting the jackpot
const JACKPOT_MULTIPLIER = 10; // 10x multiplier for the jackpot

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play the slots game and try your luck! 🎰')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount of coins to bet')
        .setRequired(true)
    ),
  cooldowns: new Map(),

  async execute(interaction) {
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet');

    // Check if the bet amount is within the allowed range
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
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

    const user = await User.findOne({ userId });

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ You don't have an account in the economy.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (user.balance < betAmount) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ You don't have enough balance to bet ${currencyFormatter.format(betAmount, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const tutorialEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎰 Slots Tutorial 🎰')
      .setDescription('Welcome to the slots game! Here\'s how to play:')
      .addFields(
        { name: '1. Place your bet', value: 'Use the `/slots <bet>` command to place your bet.' },
        { name: '2. Spin the reels', value: 'Click the "Spin" button to spin the reels.' },
        { name: '3. Check for winning combinations', value: 'If you get a winning combination, you\'ll receive a payout based on the paytable.' },
        { name: '4. Repeat', value: 'Keep playing and try to win big! 💰' }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('slots_spin')
        .setLabel('Spin')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [tutorialEmbed], components: [row] });

    const filter = i => i.customId === 'slots_spin' && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      const reels = [
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
        slotEmojis[Math.floor(Math.random() * slotEmojis.length)],
      ];

      const animationEmbed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setDescription('🎰 Spinning the reels... 🎰');

      await i.update({ embeds: [animationEmbed], components: [] });

      const animationInterval = setInterval(async () => {
        const reelsString = `${reels[0]} ${reels[1]} ${reels[2]}\n${reels[3]} ${reels[4]} ${reels[5]}\n${reels[6]} ${reels[7]} ${reels[8]}`;
        const animationEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setDescription(`🎰 Spinning the reels...\n\n${reelsString}`);

        await i.editReply({ embeds: [animationEmbed] });

        reels.unshift(reels.pop());
      }, 500);

      setTimeout(async () => {
        clearInterval(animationInterval);

        let winnings = 0;
        const winningLines = [];
        for (const payline of paylines) {
          const [a, b, c] = payline.map(index => reels[index]);
          if (a === b && b === c) {
            const multiplier = fruitMultipliers[a];
            winnings += betAmount * multiplier;
            winningLines.push({ line: payline, multiplier });
          }
        }

        const reelsString = `${reels[0]} ${reels[1]} ${reels[2]}\n${reels[3]} ${reels[4]} ${reels[5]}\n${reels[6]} ${reels[7]} ${reels[8]}`;

        const isJackpot = Math.random() < JACKPOT_CHANCE;
        if (isJackpot) {
          winnings = betAmount * JACKPOT_MULTIPLIER;
        }

        let payout = winnings > 0 ? winnings : -betAmount;

        // Deduct the bet amount from the user's balance before checking the win/loss
        user.balance -= betAmount;
        await user.save();

        if (winnings > 0 || isJackpot) {
          user.balance += payout;
          await user.save();
        }

        const embed = new EmbedBuilder()
          .setColor(winnings > 0 || isJackpot ? 0x00FF00 : 0xFF0000)
          .setTitle(winnings > 0 || isJackpot ? '🎉 You won! 🎉' : '😔 You lost... 😔')
          .setDescription(`${reelsString}\n\nYou ${winnings > 0 || isJackpot ? `won ${currencyFormatter.format(payout, { code: 'USD' })}!` : `lost ${currencyFormatter.format(betAmount, { code: 'USD' })}.`}`)
          .addFields(
            { name: 'New Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` },
            { name: 'Winning Lines', value: winningLines.length > 0 ? winningLines.map(line => `[${line.line.join(', ')}] x${line.multiplier}`).join('\n') : 'None' },
            { name: 'Jackpot', value: isJackpot ? `🎰 You hit the jackpot! 🎰` : 'No jackpot this time.' }
          );

        await i.editReply({ embeds: [embed] });
        collector.stop();

        // Set a cooldown for the user
        this.cooldowns.set(userId, Date.now() + COOLDOWN_DURATION);
      }, SPIN_DURATION);
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription('❌ You didn\'t spin the reels in time. The game has ended.');
        await interaction.editReply({ embeds: [embed], components: [] });
      }
    });
  },
};