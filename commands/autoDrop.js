const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');
const ms = require('ms');

let intervalId; // Declare intervalId outside the subcommands

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autodrop')
    .setDescription('🤑 Toggle auto-dropping money in a channel 💰')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('🚀 Start auto-dropping money')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('📢 The channel to auto-drop money in')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('interval')
            .setDescription('⏰ The interval between each drop (e.g., 30s, 5m, 1h, 2d)')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('max-amount')
            .setDescription('💰 The maximum amount of money to drop')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('expiration-time')
            .setDescription('⌛ The time before the drop expires (e.g., 30s, 5m, 1h, 2d)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('🛑 Stop auto-dropping money')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('📢 The channel to stop auto-dropping money in')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      const channel = interaction.options.getChannel('channel');
      const intervalString = interaction.options.getString('interval');
      const interval = ms(intervalString);
      const maxAmount = interaction.options.getInteger('max-amount');
      const expirationTimeString = interaction.options.getString('expiration-time');
      const expirationTime = ms(expirationTimeString);

      if (!interval || interval <= 0) {
        return interaction.reply({ content: '⚠️ Invalid interval. Please provide a valid time (e.g., 30s, 5m, 1h, 2d).', ephemeral: true });
      }

      if (!expirationTime || expirationTime <= 0) {
        return interaction.reply({ content: '⚠️ Invalid expiration time. Please provide a valid time (e.g., 30s, 5m, 1h, 2d).', ephemeral: true });
      }

      intervalId = setInterval(async () => {
        const amount = Math.floor(Math.random() * (maxAmount + 1));
        const dropEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('💰 Random Drop! 💰')
          .setDescription(`A random drop of ${currencyFormatter.format(amount, { code: 'USD' })} has been made in this channel! Click the button below to claim it!`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('claim')
            .setLabel('Claim')
            .setEmoji('💰')
            .setStyle(ButtonStyle.Success),
        );

        const dropMessage = await channel.send({ embeds: [dropEmbed], components: [row] });

        const filter = (interaction) => interaction.customId === 'claim';
        const collector = dropMessage.createMessageComponentCollector({ filter, time: expirationTime, max: 1 });

        collector.on('collect', async (interaction) => {
          const userData = await User.findOne({ userId: interaction.user.id });

          if (!userData) {
            const newUser = new User({ userId: interaction.user.id, balance: amount });
            await newUser.save();
            await interaction.update({ embeds: [dropEmbed.setDescription(`💰 <@${interaction.user.id}> has claimed the drop of ${currencyFormatter.format(amount, { code: 'USD' })}! 💰`)], components: [] });
          } else {
            userData.balance += amount;
            await userData.save();
            await interaction.update({ embeds: [dropEmbed.setDescription(`💰 <@${interaction.user.id}> has claimed the drop of ${currencyFormatter.format(amount, { code: 'USD' })}! Their new balance is ${currencyFormatter.format(userData.balance, { code: 'USD' })} 💰`)], components: [] });
          }

          collector.stop();

          const claimMessage = await channel.send(`💰 <@${interaction.user.id}> has claimed the drop of ${currencyFormatter.format(amount, { code: 'USD' })}! Their new balance is ${currencyFormatter.format(userData.balance || amount, { code: 'USD' })} 💰`);

          setTimeout(() => {
            dropMessage.delete();
            claimMessage.delete();
          }, 6000);
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            await dropMessage.edit({ embeds: [dropEmbed.setDescription(`💰 The drop of ${currencyFormatter.format(amount, { code: 'USD' })} has expired. 💰`)], components: [] });
            setTimeout(() => {
              dropMessage.delete();
            }, 6000);
          }
        });
      }, interval);

      const userId = '961788342163349574'; // Replace with the desired user ID
      const user = await interaction.client.users.fetch(userId);

      if (user) {
        await user.send(`⚠️ The auto-drop has been started in the ${channel} channel. You will need to start it again if the bot restarts.`);
      } else {
        console.error(`User with ID ${userId} not found.`);
      }

      return interaction.reply({ content: `✅ Auto-dropping has been enabled in ${channel}. A random amount between 1 and ${maxAmount} coins will be dropped every ${intervalString} and will expire after ${expirationTimeString}.`, ephemeral: true });
    } else if (subcommand === 'stop') {
      const channel = interaction.options.getChannel('channel');

      clearInterval(intervalId); // Clear the interval using the intervalId variable

      return interaction.reply({ content: `✅ Auto-dropping has been disabled in ${channel}.`, ephemeral: true });
    }
  },
};