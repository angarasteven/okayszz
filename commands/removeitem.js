const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Item = require('../models/Item');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeitem')
    .setDescription('Remove an item from the shop or your purchased items')
    .addStringOption(option =>
      option
        .setName('item_name')
        .setDescription('The name of the item to remove')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('The type of item to remove (shop or purchased)')
        .setRequired(true)
        .addChoices(
          { name: 'Shop', value: 'shop' },
          { name: 'Purchased', value: 'purchased' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const itemName = interaction.options.getString('item_name');
    const type = interaction.options.getString('type');

    if (type === 'shop') {
      const item = await Item.findOneAndDelete({ name: itemName });

      if (!item) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`❌ No item found with the name "${itemName}" in the shop.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`✅ ${item.emoji} **${item.name}** has been removed from the shop.`);
      interaction.reply({ embeds: [embed] });
    } else if (type === 'purchased') {
      const userId = interaction.user.id;
      const user = await User.findOne({ userId });

      if (!user) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`❌ You have not purchased any items yet.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const purchasedItem = user.purchasedItems.find(item => item.name === itemName);

      if (!purchasedItem) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`❌ You have not purchased an item with the name "${itemName}".`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      user.purchasedItems = user.purchasedItems.filter(item => item.name !== itemName);
      await user.save();

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setDescription(`✅ ${purchasedItem.emoji} **${purchasedItem.name}** has been removed from your purchased items.`);
      interaction.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ Invalid type. Please choose either "shop" or "purchased".');
      interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
