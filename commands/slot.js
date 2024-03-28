const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const slotEmojis = ['🍒', '🍋', '🍊', '🍇', '🍓', '🍍', '🍌', '🍉'];
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

  async execute(interaction) {
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet');

    const user = await User.findOne({ userId });

    if (!user || user.balance < betAmount) {
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
        for (const payline of paylines) {
          const [a, b, c] = payline.map(index => reels[index]);
          if (a === b && b === c) {
            winnings += betAmount * 2;
          }
        }

        const reelsString = `${reels[0]} ${reels[1]} ${reels[2]}\n${reels[3]} ${reels[4]} ${reels[5]}\n${reels[6]} ${reels[7]} ${reels[8]}`;

        if (winnings > 0) {
          user.balance += winnings;
          await user.save();
        } else {
          user.balance -= betAmount;
          await user.save();
        }

        const embed = new EmbedBuilder()
          .setColor(winnings > 0 ? 0x00FF00 : 0xFF0000)
          .setTitle(winnings > 0 ? '🎉 You won! 🎉' : '😔 You lost... 😔')
          .setDescription(`${reelsString}\n\nYou ${winnings > 0 ? `won ${currencyFormatter.format(winnings, { code: 'USD' })}!` : `lost ${currencyFormatter.format(betAmount, { code: 'USD' })}.`}`)
          .addFields({ name: 'New Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` });

        await i.editReply({ embeds: [embed] });
        collector.stop();
      }, 3000);
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
