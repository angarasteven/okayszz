const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');
const { generateRobberyStory } = require('../utils/robberyStories');

const COOLDOWN_DURATION = 600000; // 10 minutes cooldown

module.exports = {
  name: 'rob',
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob coins from another user')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user you want to rob')
        .setRequired(true)
    ),
  cooldowns: new Map(),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const robber = await User.findOne({ userId });
    const target = await User.findOne({ userId: targetUser.id });

    // Check if the target user has anti-rob protection enabled
    if (target && target.antiRobExpiration > Date.now()) {
      const remainingTime = target.antiRobExpiration - Date.now();
      const formattedTime = formatDuration(remainingTime);
      return interaction.reply({ content: `🛡️ ${targetUser.username} is under anti-rob protection for ${formattedTime}. Try someone else.`, ephemeral: true });
    }

    if (this.cooldowns.has(userId)) {
      const cooldownExpiration = this.cooldowns.get(userId);
      const remainingCooldown = cooldownExpiration - Date.now();
      if (remainingCooldown > 0) {
        return interaction.reply({ content: `⏰ You're on cooldown. Try again in ${Math.ceil(remainingCooldown / 60000)} minutes.`, ephemeral: true });
      }
    }

    if (!robber || !target) {
      return interaction.reply({ content: '👻 One of you doesn\'t exist in the economy system.', ephemeral: true });
    }

    if (robber.balance < 500) {
      return interaction.reply({ content: '😅 You need at least 500 coins to attempt a robbery.', ephemeral: true });
    }

    if (target.balance < 500) {
      return interaction.reply({ content: `😂 ${targetUser.username} doesn't have enough coins. Try someone else.`, ephemeral: true });
    }

    // Robbery story
    const robberyStory = generateRobberyStory();
    const storyEmbed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setDescription(robberyStory);

    await interaction.reply({ embeds: [storyEmbed] });

    setTimeout(async () => {
      // Robbery logic
      const maxRobberyAmount = Math.floor(target.balance * 0.25);
      const robberyAmount = Math.floor(Math.random() * maxRobberyAmount) + 1;
      const successChance = Math.random() < 0.4; // 50% chance of success

      if (successChance) {
        // Successful robbery
        robber.balance += robberyAmount;
        target.balance -= robberyAmount;
        await robber.save();
        await target.save();

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription(`💰 You successfully robbed ${currencyFormatter.format(robberyAmount, { code: 'USD' })} from ${targetUser.username}! Your new balance is ${currencyFormatter.format(robber.balance, { code: 'USD' })}.`);
        interaction.editReply({ embeds: [embed] });

        // DM the robbed user
        try {
          const dm = await targetUser.createDM();
          await dm.send(`😱 You've been robbed by ${interaction.user.username}! They took ${currencyFormatter.format(robberyAmount, { code: 'USD' })}. Consider buying anti-rob protection with \`/buyantirob\`.`);
        } catch (error) {
          console.error(`Failed to send DM to ${targetUser.username}:`, error);
        }
      } else {
        // Failed robbery
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`🚓 Your robbery attempt failed! Better luck next time.`);
        interaction.editReply({ embeds: [embed] });
      }

      // Set cooldown
      this.cooldowns.set(userId, Date.now() + COOLDOWN_DURATION);
    }, 8000); // Delay of 8 seconds for the story
  },
};

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  const formattedHours = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ` : '';
  const formattedMinutes = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''} ` : '';
  const formattedSeconds = seconds > 0 ? `${seconds} second${seconds > 1 ? 's' : ''}` : '';

  return `${formattedHours}${formattedMinutes}${formattedSeconds}`;
}
