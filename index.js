const { Client, GatewayIntentBits, Collection, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Drop cash every 5 minutes
const dropCash = require('./commands/dropCash');
setInterval(() => {
  dropCash.execute(client);
}, 300000);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

const User = require('./models/User');

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
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
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
