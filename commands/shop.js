const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Item = require('../models/Item');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('View the shop and available items'),
  async execute(interaction) {
    const items = await Item.find();

    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('🛒 The shop is currently empty.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🏪 Shop')
      .setDescription('Check out the available items in our shop!')
      .addFields(
        { name: 'How to Buy', value: '1. Use the `/buy <item_name>` command to initiate a purchase.\n2. Confirm the purchase details by clicking the "Confirm" button.\n3. Wait for the admin to process your purchase.\n4. You will receive your purchased item within a few hours or up to a day.' }
      );

    const categories = new Map();
    items.forEach(item => {
      const category = item.category || 'Miscellaneous';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(`${item.emoji} **${item.name}** - ${item.price} coins`);
    });

    for (const [category, itemList] of categories) {
      embed.addFields({ name: `${category} Items`, value: itemList.join('\n') });
    }

    interaction.reply({ embeds: [embed] });
  },
};
