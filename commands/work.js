const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');
const ms = require('ms');

const jobTypes = [
  { name: 'Cashier', basePayment: 100, cooldown: '4h' },
  { name: 'Programmer', basePayment: 300, cooldown: '6h' },
  { name: 'Doctor', basePayment: 500, cooldown: '8h' },
  { name: 'Lawyer', basePayment: 800, cooldown: '12h' },
  { name: 'CEO', basePayment: 1500, cooldown: '24h' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work at your job to earn coins')
    .addStringOption(option =>
      option
        .setName('job')
        .setDescription('The job you want to work at')
        .setRequired(true)
        .addChoices(
          { name: 'Cashier', value: 'cashier' },
          { name: 'Programmer', value: 'programmer' },
          { name: 'Doctor', value: 'doctor' },
          { name: 'Lawyer', value: 'lawyer' },
          { name: 'CEO', value: 'ceo' }
        )
    ),
  async execute(interaction) {
    const userId = interaction.user.id;
    const jobName = interaction.options.getString('job');

    const user = await User.findOne({ userId });

    if (!user) {
      const newUser = new User({ userId });
      await newUser.save();
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ You do not have an account in the economy. An account has been created for you.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const job = jobTypes.find(j => j.name.toLowerCase() === jobName.toLowerCase());

    if (!job) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription('❌ Invalid job type. Please choose a valid job from the options.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const currentTime = Date.now();
    const lastWorkTime = user.lastWorkTime || 0;
    const cooldownDuration = ms(job.cooldown);

    if (currentTime < lastWorkTime + cooldownDuration) {
      const remainingTime = ms(lastWorkTime + cooldownDuration - currentTime, { long: true });
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(`❌ You cannot work at this job again for another ${remainingTime}. Come back later!`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const jobLevel = user.jobLevel[job.name.toLowerCase()] || 1;
    const paymentMultiplier = 1 + (jobLevel - 1) * 0.1; // 10% bonus per job level
    const payment = Math.floor(job.basePayment * paymentMultiplier * (1 + Math.random() * 0.5)); // Random bonus up to 50%

    user.balance += payment;
    user.lastWorkTime = currentTime;
    user.jobLevel[job.name.toLowerCase()] = jobLevel + 1;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`🏢 You worked as a ${job.name}!`)
      .setDescription(`You earned ${currencyFormatter.format(payment, { code: 'USD' })} from your job. Your new balance is ${currencyFormatter.format(user.balance, { code: 'USD' })}.`)
      .addFields(
        { name: 'Job Level', value: `${jobLevel} → ${jobLevel + 1}`, inline: true },
        { name: 'Payment Multiplier', value: `x${paymentMultiplier.toFixed(1)}`, inline: true }
      );

    interaction.reply({ embeds: [embed] });
  },
};
