const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropcash')
    .setDescription('Drop cash in a specific channel'),
  async execute(client) {
    const targetChannelId = '1109831822495461453'; // Replace with the desired channel ID
    const targetChannel = client.channels.cache.get(targetChannelId);

    if (!targetChannel) {
      console.error(`Channel with ID ${targetChannelId} not found.`);
      return;
    }

    const dropAmount = Math.floor(Math.random() * 3001); // Random amount between 0 and 3000

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(`💰 **${currencyFormatter.format(dropAmount, { code: 'USD' })}** has been dropped in this channel! Type \`cashget\` to claim it!`);

    const dropMessage = await targetChannel.send({ embeds: [embed] });

    const filter = (message) => message.content.toLowerCase() === 'cashget';
    const collector = targetChannel.createMessageCollector({ filter, time: 240000 }); // 4 minutes (240000 milliseconds)

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

      await targetChannel.send({ embeds: [confirmEmbed] });

      collector.stop();

      setTimeout(async () => {
        const messages = await targetChannel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(message => message.author.bot);
        await targetChannel.bulkDelete(botMessages);
      }, 10000);
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription('💰 The dropped cash has expired.');
        await targetChannel.send({ embeds: [expiredEmbed] });

        setTimeout(async () => {
          const messages = await targetChannel.messages.fetch({ limit: 100 });
          const botMessages = messages.filter(message => message.author.bot);
          await targetChannel.bulkDelete(botMessages);
        }, 10000);
      }
    });
  },
};