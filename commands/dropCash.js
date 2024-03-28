const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropcash')
    .setDescription('Drop cash in an active channel'),
  async execute(client) {
    const activeChannels = client.channels.cache.filter(channel => channel.type === 0 && channel.members.size > 0);

    if (activeChannels.size === 0) return;

    const activeChannel = activeChannels.random();
    const dropAmount = Math.floor(Math.random() * 3001); // Random amount between 0 and 3000

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`💰 **${currencyFormatter.format(dropAmount, { code: 'USD' })}** has been dropped in this channel! Type \`cashget\` to claim it!`);

    const dropMessage = await activeChannel.send({ embeds: [embed] });

    const filter = (message) => message.content.toLowerCase() === 'cashget';
    const collector = activeChannel.createMessageCollector({ filter, time: 10000 });

    collector.on('collect', async (message) => {
      const userId = message.author.id;
      let user = await User.findOne({ userId });

      if (!user) {
        user = new User({ userId });
        await user.save();
      }

      user.balance += dropAmount;
      await user.save();

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`🎉 Congratulations, <@${userId}>! You claimed ${currencyFormatter.format(dropAmount, { code: 'USD' })}! Your new balance is ${currencyFormatter.format(user.balance, { code: 'USD' })}.`);

      await activeChannel.send({ embeds: [confirmEmbed] });

      collector.stop();

      setTimeout(async () => {
        const messages = await activeChannel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(message => message.author.bot);
        await activeChannel.bulkDelete(botMessages);
      }, 10000);
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription('💰 The dropped cash has expired.');
        await activeChannel.send({ embeds: [expiredEmbed] });

        setTimeout(async () => {
          const messages = await activeChannel.messages.fetch({ limit: 100 });
          const botMessages = messages.filter(message => message.author.bot);
          await activeChannel.bulkDelete(botMessages);
        }, 10000);
      }
    });
  },
};