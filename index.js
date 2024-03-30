const { Client, GatewayIntentBits, Collection, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const level = require('./levelling/textlevelling');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  startAutodrop();
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

const refreshCommands = async () => {
  try {
    console.log('Refreshing application (/) commands...');

    const commands = [];
    for (const command of client.commands.values()) {
      commands.push(command.data);
    }

    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
};

refreshCommands();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    try {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    } catch (replyError) {
      if (replyError.code === 10062) {
        console.error('Unknown interaction error occurred:', replyError);
        // Handle the error or perform any necessary actions
      } else {
        console.error('Error replying to interaction:', replyError);
      }
    }
  }
});

const startAutodrop = async () => {
  const channelId = '1223205008879652925'; // Replace with the desired channel ID
  const dropInterval = 60000; // 10 minutes (in milliseconds)
  const expireTime = 60000; // 1 minute

  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.error(`Channel with ID ${channelId} not found.`);
        return;
      }

      const amount = Math.floor(Math.random() * 3000) + 1;
      const dropEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💰 Random Drop! 💰')
        .setDescription(`A random drop of ${currencyFormatter.format(amount, { code: 'USD' })} has been made in this channel! Click the button below to claim it!`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('claim')
          .setLabel('Claim')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success),
      );

      const dropMessage = await channel.send({ embeds: [dropEmbed], components: [row] });

      const filter = (interaction) => interaction.customId === 'claim';
      const collector = dropMessage.createMessageComponentCollector({ filter, time: expireTime, max: 1 });

      collector.on('collect', async (interaction) => {
        try {
          const userId = interaction.user.id;
          let userData = await User.findOne({ userId });

          if (!userData) {
            userData = new User({ userId, balance: amount });
            await userData.save();
          } else {
            userData.balance += amount;
            await userData.save();
          }

          try {
            await interaction.update({ embeds: [dropEmbed.setDescription(`💰 <@${userId}> has claimed the drop of ${currencyFormatter.format(amount, { code: 'USD' })}! 💰`)], components: [] });
          } catch (updateError) {
            if (updateError.code === 10062) {
              console.error('Unknown interaction error occurred while updating drop message:', updateError);
              // Handle the error or perform any necessary actions
            } else {
              console.error('Error updating drop message:', updateError);
            }
          }

          const claimMessage = await channel.send(`💰 <@${userId}> has claimed the drop of ${currencyFormatter.format(amount, { code: 'USD' })}! Their new balance is ${currencyFormatter.format(userData.balance, { code: 'USD' })} 💰`);

          setTimeout(() => {
            dropMessage.delete();
            claimMessage.delete();
          }, 6000);
        } catch (error) {
          console.error('Error handling claim interaction:', error);
        }
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          try {
            await dropMessage.edit({ embeds: [dropEmbed.setDescription(`💰 The drop of ${currencyFormatter.format(amount, { code: 'USD' })} has expired. 💰`)], components: [] });
          } catch (editError) {
            if (editError.code === 10062) {
              console.error('Unknown interaction error occurred while editing drop message:', editError);
              // Handle the error or perform any necessary actions
            } else {
              console.error('Error editing drop message:', editError);
            }
          }
          setTimeout(() => {
            dropMessage.delete();
          }, 6000);
        }
      });
    } catch (error) {
      console.error('Error in autodrop:', error);
    }
  }, dropInterval);
};

// Uncaught exception handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Perform any necessary cleanup or logging here
  // You can choose to exit the process or continue running based on your requirements
  // For example:
  // process.exit(1);
});

client.login(TOKEN);

const express = require('express');
const app = express();
const port = 3000; // You can change the port number if needed

// Serve static files from the "public" directory
app.use(express.static('public'));

// Route for the root URL
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
