const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

module.exports = {
  name: 'buyantirob',
  data: new SlashCommandBuilder()
    .setName('buyantirob')
    .setDescription('Buy 24h anti-rob protection for 75k coins'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const user = await User.findOne({ userId });

    if (!user) {
      return interaction.reply({ content: '👻 You don\'t exist in the economy system.', ephemeral: true });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('Confirm Anti-Rob Purchase')
      .setDescription('Anti-Rob Protection provides 24 hours of immunity from being robbed by other users. During this period, no one will be able to steal your hard-earned coins.')
      .addFields(
        { name: 'Your Balance', value: `${currencyFormatter.format(user.balance, { code: 'USD' })}`, inline: true },
        { name: 'Price', value: '75,000 coins', inline: true }
      );

    const confirmRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_antirob')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('cancel_antirob')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    const confirmMessage = await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });

    const filter = (i) => i.user.id === userId;
    const collector = confirmMessage.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute

    collector.on('collect', async (i) => {
      if (i.customId === 'confirm_antirob') {
        if (user.balance < 75000) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription('❌ You do not have enough coins to purchase anti-rob protection.');
          await i.update({ embeds: [errorEmbed], components: [] });
          return;
        }

        user.balance -= 75000;
        user.antiRobExpiration = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        await user.save();

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription('✅ You are now protected from robbery for 24 hours.');
        await i.update({ embeds: [successEmbed], components: [] });
      } else if (i.customId === 'cancel_antirob') {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setDescription('Purchase canceled.');
        await i.update({ embeds: [cancelEmbed], components: [] });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription('❌ Purchase timed out.');
        await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
      }
    });
  },
};
