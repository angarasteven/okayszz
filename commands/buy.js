const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Item = require('../models/Item');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('🛒 Buy an item from the shop')
    .addStringOption(option =>
      option
        .setName('item_name')
        .setDescription('The name of the item you want to buy')
        .setRequired(true)
    ),
  async execute(interaction) {
    const itemName = interaction.options.getString('item_name');
    const userId = interaction.user.id;
    const adminUserId = '961788342163349574'; // Replace with the actual admin user ID

    const item = await Item.findOne({ name: itemName });
    const user = await User.findOne({ userId });

    if (!item) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Item Not Found')
        .setDescription(`Sorry, we couldn't find an item with the name "${itemName}" in our shop. Please double-check the name and try again.\n\n**Example:** \`/buy Gaming Console\``)
        .addFields({ name: 'Usage', value: '`/buy <item_name>`' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!user || user.balance < item.price) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('💸 Insufficient Funds')
        .setDescription(`You don't have enough coins to buy ${item.emoji} **${item.name}**. It costs ${currencyFormatter.format(item.price, { code: 'USD' })}, but your current balance is ${currencyFormatter.format(user.balance, { code: 'USD' })}.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const purchaseId = uuidv4();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎫 Purchase Confirmation')
      .setDescription(`Please confirm your purchase of ${item.emoji} **${item.name}** for ${currencyFormatter.format(item.price, { code: 'USD' })}.`)
      .addFields(
        { name: 'Item Description', value: item.description || 'No description provided.' },
        { name: 'Your Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` },
        { name: 'Purchase ID', value: purchaseId }
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger),
      );

    const confirmationMessage = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

    const filter = (interaction) => interaction.user.id === userId;
    const collector = confirmationMessage.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'confirm') {
        user.balance -= item.price;
        await user.save();

        const adminUser = await interaction.client.users.fetch(adminUserId);
        const transcript = `**Purchase Confirmation**\n\nUser: ${interaction.user.tag}\nItem: ${item.name}\nPrice: ${currencyFormatter.format(item.price, { code: 'USD' })}\nPurchase ID: ${purchaseId}\n\nThe user has confirmed the purchase.`;

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel('Done')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('not_done')
              .setLabel('Not Done')
              .setStyle(ButtonStyle.Danger),
          );

        const adminMessage = await adminUser.send({ content: transcript, components: [row] });

        const filter = (interaction) => interaction.user.id === adminUserId;
        const collector = adminMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (buttonInteraction) => {
          if (buttonInteraction.customId === 'done') {
            await interaction.user.send(`🎉 Congratulations! You have received ${item.emoji} **${item.name}**. Thank you for your purchase!`);
            await buttonInteraction.update({ content: 'Purchase confirmed.', components: [] });
          } else if (buttonInteraction.customId === 'not_done') {
            const row = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('report')
                  .setLabel('Report')
                  .setStyle(ButtonStyle.Danger),
              );
            await interaction.user.send({ content: 'Your purchase has been rejected. If you would like to report this issue, click the "Report" button below.', components: [row] });
            await buttonInteraction.update({ content: 'Purchase rejected.', components: [] });
          }
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            await adminUser.send('Purchase timed out.');
          }
        });

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎉 Purchase Successful! 🎉')
          .setDescription(`Thank you for your purchase! You have successfully bought ${item.emoji} **${item.name}** for ${currencyFormatter.format(item.price, { code: 'USD' })}.`)
          .addFields({ name: 'Remaining Balance', value: `💰 ${currencyFormatter.format(user.balance, { code: 'USD' })}` })
          .addFields({ name: 'Note', value: 'Please note that it may take a few hours or up to a day to receive your purchased item.' });

        await buttonInteraction.update({ embeds: [successEmbed], components: [] });
      } else if (buttonInteraction.customId === 'cancel') {
        await buttonInteraction.update({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('Purchase canceled.')], components: [] });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('Purchase timed out.')], components: [] });
      }
    });
  },
};
