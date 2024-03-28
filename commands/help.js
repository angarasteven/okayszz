const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of available commands'),
  async execute(interaction) {
    // Command Groups
    const commandGroups = {
      'Fun': ['add', 'additem', 'balance', 'buy', 'coinflip', 'daily', 'give', 'giveaway', 'help', 'leaderboard', 'remove', 'removeitem', 'rob', 'shop', 'slot', 'work']
    };

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Economc Bot Commands')
    
    for (const category in commandGroups) {
      let categoryDescription = '';
      commandGroups[category].forEach(commandName => {
        categoryDescription += `> **${commandName}**\n`;
      });
      embed.addFields({ name: category, value: categoryDescription, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
