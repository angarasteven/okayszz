const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteuser')
    .setDescription('Delete a user\'s data from the database')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user whose data you want to delete')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Check if the user has the required permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    // Find the user's data in the database
    const userData = await User.findOne({ userId: user.id });

    if (!userData) {
      return interaction.reply({ content: `No data found for ${user.username}.`, ephemeral: true });
    }

    try {
      // Delete the user's data from the database
      await User.findOneAndDelete({ userId: user.id });

      return interaction.reply({ content: `${user.username}'s data has been deleted from the database.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'An error occurred while deleting the user\'s data.', ephemeral: true });
    }
  },
};