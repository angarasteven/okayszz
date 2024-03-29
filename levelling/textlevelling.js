const User = require('../models/User');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const cooldowns = new Map();
const levelUpMessages = [
  'Congratulations! 🎉 You just leveled up! 🆙',
  'Level up! 🥳 Keep up the great work! 💪',
];

const announcementChannelId = '1223205008879652925'; // Replace with your channel ID

const calculateExperience = (message) => {
  const randomExperience = Math.floor(Math.random() * 10) + 15; // Random experience between 15 and 24
  const bonusExperience = message.content.split(' ').length - 1; // Bonus experience based on message length
  return randomExperience + bonusExperience;
};

const handleLevelUp = async (user, message) => {
  const randomMessage = levelUpMessages[Math.floor(Math.random() * levelUpMessages.length)];
  const rewardAmount = user.level * 200; // Adjust the reward amount as needed
  user.balance += rewardAmount;

  const embed = new EmbedBuilder()
    .setColor('GREEN')
    .setDescription(`${randomMessage}\n\n${user.username} is now level ${user.level}! 🎯\nExperience: ${user.textExperience}/${user.requiredExperience}\nNew Balance: ${user.balance} 💰`);

  await user.save();

  const announcementChannel = message.guild.channels.cache.get(announcementChannelId);
  if (announcementChannel) {
    announcementChannel.send({ embeds: [embed] });
  } else {
    message.reply({ embeds: [embed] });
  }
};

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({ userId });
      const embed = new EmbedBuilder()
        .setColor('GREEN')
        .setDescription(`Welcome, ${message.author.username}! Your starting balance is ${user.balance} 💰`);
      message.reply({ embeds: [embed] });
    }

    if (cooldowns.has(userId)) {
      const cooldownTime = cooldowns.get(userId);
      const remainingTime = cooldownTime - Date.now();
      if (remainingTime > 0) {
        return; // User is on cooldown, do nothing
      }
    }

    const experienceGained = calculateExperience(message);
    user.textExperience += experienceGained;

    if (user.textExperience >= user.requiredExperience) {
      user.level += 1;
      user.textExperience = 0;
      user.requiredExperience = Math.floor(user.requiredExperience * 1.5); // Increase required experience by 50%

      await handleLevelUp(user, message);
    } else {
      await user.save();
    }

    const cooldownDuration = 60000; // 1 minute cooldown
    cooldowns.set(userId, Date.now() + cooldownDuration);
    setTimeout(() => cooldowns.delete(userId), cooldownDuration);
  },
};