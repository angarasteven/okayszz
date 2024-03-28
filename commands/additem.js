const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Item = require('../models/Item');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('Add a new item to the shop')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The name of the item')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName('price')
        .setDescription('The price of the item')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('The category of the item')
    )
    .addStringOption(option =>
      option
        .setName('emoji')
        .setDescription('The emoji to represent the item')
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('The description of the item')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const price = interaction.options.getNumber('price');
    const category = interaction.options.getString('category') || null;
    const emoji = interaction.options.getString('emoji') || '📦';
    const description = interaction.options.getString('description') || null;

    const newItem = new Item({ name, price, category, emoji, description });
    await newItem.save();

    const formattedPrice = price.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    interaction.reply(`✅ Added ${emoji} **${name}** to the shop for ${formattedPrice}.\n${description ? `\n**Description:** ${description}` : ''}`);
  },
};