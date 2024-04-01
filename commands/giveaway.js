const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Giveaway = require('../models/Giveaway');
const User = require('../models/User');
const ms = require('ms');

module.exports = {
  name: 'giveaway',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('The type of prize (money or item)')
            .setRequired(true)
            .addChoices(
              { name: 'Money', value: 'money' },
              { name: 'Item', value: 'item' }
            )
        )
        .addNumberOption(option =>
          option
            .setName('value')
            .setDescription('The amount of money or the item ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('The duration of the giveaway (e.g., 1h, 30m, 2d)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('item-name')
            .setDescription('The name of the item (if type is "item")')
        )
    ),
  async execute(interaction) {
    if (!interaction.memberPermissions.has('ADMINISTRATOR')) {
      return interaction.reply({ content: '❌ You need to be an administrator to start a giveaway.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      const type = interaction.options.getString('type');
      const value = interaction.options.getNumber('value');
      const duration = interaction.options.getString('duration');
      const itemName = interaction.options.getString('item-name') || null;

      const endTime = Date.now() + ms(duration);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 Giveaway: ${type === 'money' ? `${value} coins` : itemName}`)
        .setDescription(`React with 🎉 to enter the giveaway!\n\nEnds: <t:${Math.floor(endTime / 1000)}:R>`)
        .setColor(0x00FF00);

      const message = await interaction.reply({ embeds: [embed], fetchReply: true });

      message.react('🎉');

      const giveaway = new Giveaway({
        messageId: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        prize: {
          type,
          value,
          name: itemName,
        },
        endTime,
        participants: [],
      });

      await giveaway.save();

      const updateGiveawayEmbed = async () => {
        const giveawayData = await Giveaway.findOne({ messageId: message.id });

        if (!giveawayData) return;

        const reaction = message.reactions.cache.get('🎉');
        const participants = await reaction.users.fetch();

        const updatedParticipants = participants
          .filter(user => !user.bot)
          .map(user => user.id)
          .filter(id => !giveawayData.participants.includes(id));

        giveawayData.participants.push(...updatedParticipants);
        await giveawayData.save();

        const timeLeft = giveawayData.endTime - Date.now();
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        const updatedEmbed = new EmbedBuilder()
          .setTitle(`🎉 Giveaway: ${giveawayData.prize.type === 'money' ? `${giveawayData.prize.value} coins` : giveawayData.prize.name}`)
          .setDescription(`React with 🎉 to enter the giveaway!\n\nParticipants: ${giveawayData.participants.length}\n\nTime Left: ${days}d ${hours}h ${minutes}m ${seconds}s`)
          .setColor(0x00FF00);

        message.edit({ embeds: [updatedEmbed] });

        if (timeLeft <= 0) {
          const winnerId = giveawayData.participants[Math.floor(Math.random() * giveawayData.participants.length)];
          giveawayData.winnerId = winnerId;
          await giveawayData.save();

          const winner = await interaction.client.users.fetch(winnerId);
          const winnerDM = await winner.createDM();

          if (giveawayData.prize.type === 'money') {
            const user = await User.findOne({ userId: winnerId });
            user.balance += giveawayData.prize.value;
            await user.save();

            await winnerDM.send(`🎉 Congratulations! You won ${giveawayData.prize.value} coins in the giveaway! Your new balance is ${user.balance} coins.`);
          } else {
            await winnerDM.send(`🎉 Congratulations! You won the ${giveawayData.prize.name} item in the giveaway!`);
          }

          const winnerEmbed = new EmbedBuilder()
            .setTitle('🎉 Giveaway Winner')
            .setDescription(`The winner of the giveaway for ${giveawayData.prize.type === 'money' ? `${giveawayData.prize.value} coins` : giveawayData.prize.name} is ${winner.username}!`)
            .setColor(0x00FF00);

          await message.edit({ embeds: [winnerEmbed] });
          await message.channel.send(`Congratulations ${winner}! You won the giveaway!`);

          await Giveaway.findOneAndDelete({ messageId: message.id });
        }
      };

      const checkOngoingGiveaways = async () => {
        const ongoingGiveaways = await Giveaway.find({ endTime: { $gt: Date.now() } });

        for (const giveaway of ongoingGiveaways) {
          const channel = interaction.client.channels.cache.get(giveaway.channelId);
          if (!channel) continue;

          const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
          if (!message) continue;

          const reaction = message.reactions.cache.get('🎉');
          if (!reaction) continue;

          const participants = await reaction.users.fetch();

          const updatedParticipants = participants
            .filter(user => !user.bot)
            .map(user => user.id)
            .filter(id => !giveaway.participants.includes(id));

          giveaway.participants.push(...updatedParticipants);
          await giveaway.save();
        }
      };

      checkOngoingGiveaways();
      setInterval(updateGiveawayEmbed, 10000);
      setInterval(checkOngoingGiveaways, 60000); // Check for ongoing giveaways every minute
    }
  },
};
