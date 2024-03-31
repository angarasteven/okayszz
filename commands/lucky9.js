const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const MIN_BET = 100;
const MAX_BET = 10000;
const COOLDOWN_DURATION = 7000;
const STREAK_MULTIPLIER = 1.2;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lucky9')
    .setDescription('Let\'s play Lucky9! Get as close to 9 as possible without going over. 🍀')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of money to bet')
        .setRequired(true)
    ),
  cooldowns: new Map(),
  streaks: new Map(),

  async execute(interaction) {
    await interaction.deferReply(); // Defer the reply

    const userId = interaction.user.id;
    const amount = interaction.options.getInteger('amount');

    // Check if the bet amount is within the allowed range
    if (amount < MIN_BET || amount > MAX_BET) {
      return interaction.editReply(`The bet amount should be between ${currencyFormatter.format(MIN_BET, { code: 'USD' })} and ${currencyFormatter.format(MAX_BET, { code: 'USD' })}.`);
    }

    // Check if the user is on cooldown
    if (this.cooldowns.has(userId)) {
      const cooldownExpiration = this.cooldowns.get(userId);
      const remainingCooldown = cooldownExpiration - Date.now();
      if (remainingCooldown > 0) {
        return interaction.editReply(`You're on cooldown for ${Math.ceil(remainingCooldown / 1000)} more seconds. Please wait! ⏰`);
      }
    }

    // Get the user from the database
    const user = await User.findOne({ userId });

    // Check if the user exists in the database
    if (!user) {
      return interaction.editReply('You need to use the `/daily` command first to claim your daily reward and start playing.');
    }

    const userBalance = user.balance;

    // Check if the user has enough balance
    if (userBalance < amount) {
      return interaction.editReply(`You don't have enough money to make this bet. Your current balance is ${currencyFormatter.format(userBalance, { code: 'USD' })}.`);
    }

    // Play Lucky9
    const playerHand = [...this.drawCard()];
    let playerScore = this.calculateScore(playerHand);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Lucky9')
      .setDescription('Get as close to 9 as possible without going over.')
      .addFields(
        { name: 'Your Hand', value: `${this.formatHand(playerHand)} (${playerScore})`, inline: true },
        { name: 'Draw Another Card?', value: 'Click the buttons below to draw another card or stand.', inline: false }
      );

    const drawButton = new ButtonBuilder()
      .setCustomId('draw')
      .setLabel('Draw')
      .setStyle(ButtonStyle.Primary);

    const standButton = new ButtonBuilder()
      .setCustomId('stand')
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder()
      .addComponents(drawButton, standButton);

    const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true }); // Edit the deferred reply

    let hasDrawn = false;

    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 30000 }); // Increase the time to 30 seconds

    collector.on('collect', async i => {
      if (i.customId === 'draw') {
        if (hasDrawn) {
          await i.reply({ content: 'You can only draw a card once. Please stand or wait for the game to end.', ephemeral: true });
        } else {
          await i.deferUpdate();
          const newCard = this.drawCard();
          playerHand.push(...newCard);
          playerScore = this.calculateScore(playerHand);
          hasDrawn = true;

          if (playerScore > 9) {
            collector.stop('bust');
          } else {
            const updatedEmbed = EmbedBuilder.from(embed)
              .spliceFields(0, 1, { name: 'Your Hand', value: `${this.formatHand(playerHand)} (${playerScore})`, inline: true });
            await i.editReply({ embeds: [updatedEmbed] });
          }
        }
      } else if (i.customId === 'stand') {
        await i.deferUpdate();
        collector.stop('stand');
      }
    });

    collector.on('end', async (collected, reason) => {
      let result;
      if (reason === 'bust') {
        result = 'lose';
      } else if (reason === 'stand') {
        result = playerScore === 9 ? 'win' : 'lose';
      } else {
        result = 'timeout';
      }

      const won = result === 'win';

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
      const resultText = won ? 'You won!' : result === 'bust' ? 'You busted!' : result === 'timeout' ? 'Time\'s up!' : 'You lost!';
      const updatedEmbed = EmbedBuilder.from(embed)
        .setColor(won ? 0x00FF00 : 0xFF0000)
        .setDescription(`${resultText} ${payout !== 0 ? `You ${won ? 'gained' : 'lost'} ${currencyFormatter.format(Math.abs(payout), { code: 'USD' })}.` : ''}`)
        .spliceFields(1, 1)
        .addFields(
          { name: 'Your Balance', value: `${currencyFormatter.format(userBalance + payout, { code: 'USD' })}`, inline: false },
          { name: 'Streak', value: `${streak}`, inline: true },
          { name: 'Multiplier', value: `${multiplier}x`, inline: true }
        );
      await interaction.editReply({ embeds: [updatedEmbed], components: [] });
    });
  },

  drawCard() {
    const suits = ['♠️', '♥️', '♣️', '♦️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9'];

    // Adjust the probability of drawing certain cards
    const weightedValues = [
      ...Array(4).fill('A'),
      ...Array(4).fill('2'),
      ...Array(4).fill('3'),
      ...Array(4).fill('4'),
      ...Array(4).fill('5'),
      ...Array(4).fill('6'),
      ...Array(4).fill('7'),
      ...Array(4).fill('8'),
      ...Array(4).fill('9')
    ];

    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = weightedValues[Math.floor(Math.random() * weightedValues.length)];
    return [`${value}${suit}`];
  },

  calculateScore(hand) {
    let score = 0;
    for (const card of hand) {
      const value = card.slice(0, -1);
      score += value === 'A' ? 1 : parseInt(value);
    }
    return score;
  },

  formatHand(hand) {
    return hand.join(' ');
  }
};
