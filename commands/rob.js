const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const COOLDOWN_DURATION = 180000; // 3 minutes cooldown
module.exports = {
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
    const robber = await User.findOne({ userId });
    const targetUser = interaction.options.getUser('target');
    const target = await User.findOne({ userId: targetUser.id });

    // Check if the user is on cooldown
    if (this.cooldowns.has(userId)) {
      const cooldownExpiration = this.cooldowns.get(userId);
      const remainingCooldown = cooldownExpiration - Date.now();
      if (remainingCooldown > 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`⏰ You're on cooldown for ${Math.ceil(remainingCooldown / 1000)} more seconds before you can rob again.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (!robber || !target) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ Either you or the target user does not have an account in the economy.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (robber.balance < 500) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ You need at least 500 coins in your balance to attempt a robbery.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (target.balance < 500) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ ${targetUser.username} doesn't have enough coins to make it worth robbing.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const robberBalance = robber.balance;
    const targetBalance = target.balance;
    const maxRobberyAmount = Math.floor(targetBalance * 0.25); // Maximum amount that can be robbed (25% of target's balance)
    const robberyAmount = Math.floor(Math.random() * maxRobberyAmount) + 1; // Random amount between 1 and maxRobberyAmount

    const successChance = Math.floor(Math.random() * 100); // Random number between 0 and 99
    const successRate = Math.floor((robberBalance / (robberBalance + targetBalance)) * 100); // Success rate based on the balance ratio

    const storyEmbed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setDescription(`🏡 ${interaction.user.username} sneaks up to ${targetUser.username}'s house, carefully avoiding the security cameras. 🚨\n\n👀 After scouting the area, you spot an open window on the second floor. You grab a nearby ladder and climb up, trying not to make a sound. 🤫\n\n💥 With a swift motion, you smash the window and jump inside, landing in what appears to be a bedroom. The alarm starts blaring, and you hear footsteps approaching. 🚔\n\n🔍 You quickly scan the room for valuables and spot a safe in the corner. You rush towards it and start fiddling with the lock. 🔐\n\n⏰ Time is running out, and you can hear the police sirens getting closer. Will you be able to crack the safe and make off with the loot, or will you be caught red-handed? 🚓`);

    await interaction.reply({ embeds: [storyEmbed] });

    setTimeout(async () => {
      if (successChance <= successRate) {
        // Successful robbery
        robber.balance += robberyAmount;
        target.balance -= robberyAmount;
        await robber.save();
        await target.save();

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription(`💰 You successfully cracked the safe and made off with ${currencyFormatter.format(robberyAmount, { code: 'USD' })}! Your new balance is ${currencyFormatter.format(robber.balance, { code: 'USD' })}. 🏃‍♂️`);
        interaction.editReply({ embeds: [embed] });
      } else {
        // Failed robbery
        const lossAmount = Math.floor(robberBalance * 0.1); // 10% of the robber's balance is lost
        robber.balance -= lossAmount;
        await robber.save();

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(`🚔 The police caught you red-handed! You were arrested and fined ${currencyFormatter.format(lossAmount, { code: 'USD' })}. Your new balance is ${currencyFormatter.format(robber.balance, { code: 'USD' })}. 😔`);
        interaction.editReply({ embeds: [embed] });
      }

      // Set a cooldown for the user
      this.cooldowns.set(userId, Date.now() + COOLDOWN_DURATION);
    }, 5000); // Delay of 5 seconds for the story
  },
};