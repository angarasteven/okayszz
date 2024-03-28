const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the richest users in the economy'),
  async execute(interaction) {
    const users = await User.find().sort({ balance: -1 }).limit(10);

    if (users.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('🏆 No users found in the economy leaderboard.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const leaderboardEntries = users.map((user, index) => {
      const position = index + 1;
      const emoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      return `${emoji} <@${user.userId}> - ${currencyFormatter.format(user.balance, { code: 'USD' })}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏆 Economy Leaderboard 🏆')
      .setDescription(leaderboardEntries.join('\n'))
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    interaction.reply({ embeds: [embed] });
  },
};
