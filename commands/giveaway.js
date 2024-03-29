const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');
const Giveaway = require('../models/Giveaway');
const currencyFormatter = require('currency-formatter');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Start a money giveaway in the economy 💰')
    .addIntegerOption(option =>
      option
        .setName('prize')
        .setDescription('The amount of coins to be given away')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('The duration of the giveaway (e.g., 1h, 30m, 5d)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const prize = interaction.options.getInteger('prize');
    const duration = interaction.options.getString('duration');
    const durationMs = ms(duration);

    if (!durationMs || durationMs <= 0) {
      return interaction.reply({ content: '⚠️ Invalid duration. Please provide a valid duration (e.g., 1h, 30m, 5d).', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Money Giveaway! 💰')
      .setDescription(`A giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰 has started! Click the "Enter" button below to participate.\n\nDuration: ${duration}\nParticipants: 0`)
      .setFooter({ text: 'Made by _trulysatoshi' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('enter')
          .setLabel('Enter')
          .setStyle(ButtonStyle.Success),
      );

    const giveawayMessage = await interaction.reply({ embeds: [embed], components: [row] });

    const entrants = [];
    const filter = (interaction) => interaction.customId === 'enter';
    const collector = giveawayMessage.createMessageComponentCollector({ filter, time: durationMs });

    collector.on('collect', async (buttonInteraction) => {
      const userId = buttonInteraction.user.id;
      if (!entrants.includes(userId)) {
        entrants.push(userId);
        await buttonInteraction.reply({ content: `✅ You have entered the giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰!`, ephemeral: true });
      } else {
        await buttonInteraction.reply({ content: '⚠️ You have already entered this giveaway.', ephemeral: true });
      }
    });

    collector.on('end', async (collected) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('enter')
          .setLabel('Giveaway Ended')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
      );

      await giveawayMessage.edit({ components: [row] });
      await Giveaway.findOneAndDelete({ messageId: giveawayMessage.id });

      if (entrants.length > 0) {
        const winnerId = entrants[Math.floor(Math.random() * entrants.length)];
        const winner = await interaction.client.users.fetch(winnerId);
        const winnerUser = await User.findOne({ userId: winnerId });

        if (!winnerUser) {
          const newUser = new User({ userId: winnerId, balance: prize });
          await newUser.save();
          await winner.send(`🎉 Congratulations! You won the giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰 in the ${interaction.channel} channel!`);
          await interaction.channel.send(`🎉 Congratulations, <@${winnerId}>! You won the giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰! Your balance has been updated.`);
        } else {
          winnerUser.balance += prize;
          await winnerUser.save();
          await winner.send(`🎉 Congratulations! You won the giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰 in the ${interaction.channel} channel! Your new balance is ${currencyFormatter.format(winnerUser.balance, { code: 'USD' })}.`);
          await interaction.channel.send(`🎉 Congratulations, <@${winnerId}>! You won the giveaway for ${currencyFormatter.format(prize, { code: 'USD' })} 💰! Your new balance is ${currencyFormatter.format(winnerUser.balance, { code: 'USD' })}.`);
        }
      } else {
        await interaction.editReply({ content: '😔 No one entered the giveaway.', components: [] });
      }
    });
  },
};