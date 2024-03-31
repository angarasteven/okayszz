const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const BOARD_SIZE = 3;
const EMPTY_CELL = '⬜';
const PLAYER_SYMBOL = '❌';
const OPPONENT_SYMBOL = '⭕';
const MIN_BET = 100; // Minimum bet amount
const MAX_BET = 10000; // Maximum bet amount
const REWARD_MULTIPLIER = 3; // Reward multiplier for winning

const winningCombinations = [
  [0, 1, 2], // Horizontal
  [3, 4, 5], // Horizontal
  [6, 7, 8], // Horizontal
  [0, 3, 6], // Vertical
  [1, 4, 7], // Vertical
  [2, 5, 8], // Vertical
  [0, 4, 8], // Diagonal
  [2, 4, 6], // Diagonal
];

function getValidUser(interaction, optionName) {
  const user = interaction.options.getUser(optionName);
  if (!user) {
    throw new Error(`Please provide a valid user for the ${optionName} option.`);
  }
  return user;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoeuser')
    .setDescription('Play a game of Tic Tac Toe against another user!')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount of coins to bet')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('The user you want to challenge')
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = await User.findOne({ userId: interaction.user.id });
    if (!user) return interaction.reply('You don\'t have an account yet. Use `/daily` to create one and get your starting balance.');

    const betAmount = interaction.options.getInteger('bet');
    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      return interaction.reply(`The bet amount should be between ${currencyFormatter.format(MIN_BET, { code: 'COINS' })} and ${currencyFormatter.format(MAX_BET, { code: 'COINS' })}. Don't be a cheapskate or a high-roller, my friend! 💰`);
    }

    if (user.balance < betAmount) {
      return interaction.reply(`You don't have enough coins to make that bet. Your balance is ${currencyFormatter.format(user.balance, { code: 'COINS' })}. Time to start saving up or find a better job! 💸`);
    }

    try {
      const opponent = getValidUser(interaction, 'opponent'); [1]
      const opponentUser = await User.findOne({ userId: opponent.id });
      if (!opponentUser) return interaction.reply(`${opponent.username} doesn't have an account yet. Tell them to use \`/daily\` to create one!`);

      if (opponentUser.balance < betAmount) {
        return interaction.reply(`${opponent.username} doesn't have enough coins to make that bet. Their balance is ${currencyFormatter.format(opponentUser.balance, { code: 'COINS' })}. Maybe they should get a better job too! 💼`);
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe Challenge')
        .setDescription(`${opponent}, ${interaction.user.username} has challenged you to a game of Tic Tac Toe with a bet of ${currencyFormatter.format(betAmount, { code: 'COINS' })}. Do you accept?`);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('decline')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger)
        );

      const confirmMessage = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

      const filter = (i) => i.customId === 'accept' || i.customId === 'decline';
      const collector = confirmMessage.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async (i) => {
        if (i.customId === 'accept') {
          opponentUser.balance -= betAmount;
          user.balance -= betAmount;
          await opponentUser.save();
          await user.save();

          collector.stop();
          confirmMessage.delete();

          const gameData = {
            board: Array(BOARD_SIZE ** 2).fill(EMPTY_CELL),
            currentPlayer: PLAYER_SYMBOL,
            playerUser: user,
            opponentUser: opponentUser,
            betAmount,
          };

          startGame(interaction, gameData);
        } else {
          collector.stop();
          confirmMessage.delete();
          interaction.editReply({ content: 'The challenge has been declined.', components: [] });
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          confirmMessage.edit({ content: 'The challenge has expired.', components: [] });
        }
      });
    } catch (error) {
      return interaction.reply(error.message); [1]
    }
  },
};

async function startGame(interaction, gameData) {
  const gameEmbed = new EmbedBuilder()
    .setTitle('Tic Tac Toe')
    .setDescription(`${gameData.currentPlayer === PLAYER_SYMBOL ? interaction.user.username : gameData.opponentUser.username}'s turn\n\n${renderBoard(gameData.board, gameData.currentPlayer)}`)
    .addFields(
      { name: `${interaction.user.username}'s Symbol`, value: PLAYER_SYMBOL, inline: true },
      { name: `${gameData.opponentUser.username}'s Symbol`, value: OPPONENT_SYMBOL, inline: true },
      { name: 'Bet Amount', value: `${currencyFormatter.format(gameData.betAmount, { code: 'COINS' })}`, inline: true }
    );

  const rows = [];
  for (let i = 0; i < BOARD_SIZE ** 2; i += BOARD_SIZE) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < BOARD_SIZE && i + j < BOARD_SIZE ** 2; j++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tictactoeuser_${i + j}`)
          .setLabel(gameData.board[i + j] === EMPTY_CELL ? '\u200b' : gameData.board[i + j])
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(gameData.board[i + j] !== EMPTY_CELL)
      );
    }
    rows.push(row);
  }

  const gameMessage = await interaction.followUp({ embeds: [gameEmbed], components: rows, ephemeral: false });

  const filter = (i) => i.customId.startsWith('tictactoeuser_') && (i.user.id === gameData.playerUser.userId || i.user.id === gameData.opponentUser.userId);
  const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 * 5 }); // 5 minute timeout

  collector.on('collect', async (i) => {
    const cellIndex = parseInt(i.customId.split('_')[1]);
    if (gameData.board[cellIndex] !== EMPTY_CELL) {
      const errorMessage = await i.reply({ content: 'That cell is already taken! Try again, smartypants! 🤓', ephemeral: true });
      setTimeout(() => {
        errorMessage.delete();
      }, 4000);
      return;
    }

    if (i.user.id !== (gameData.currentPlayer === PLAYER_SYMBOL ? gameData.playerUser.userId : gameData.opponentUser.userId)) {
      const errorMessage = await i.reply({ content: 'It\'s not your turn yet! Wait for your opponent to make their move.', ephemeral: true });
      setTimeout(() => {
        errorMessage.delete();
      }, 4000);
      return;
    }

    gameData.board[cellIndex] = gameData.currentPlayer;
    gameData.currentPlayer = gameData.currentPlayer === PLAYER_SYMBOL ? OPPONENT_SYMBOL : PLAYER_SYMBOL;

    const gameEmbed = new EmbedBuilder()
      .setTitle('Tic Tac Toe')
      .setDescription(`${gameData.currentPlayer === PLAYER_SYMBOL ? interaction.user.username : gameData.opponentUser.username}'s turn\n\n${renderBoard(gameData.board, gameData.currentPlayer)}`)
      .addFields(
        { name: `${interaction.user.username}'s Symbol`, value: PLAYER_SYMBOL, inline: true },
        { name: `${gameData.opponentUser.username}'s Symbol`, value: OPPONENT_SYMBOL, inline: true },
        { name: 'Bet Amount', value: `${currencyFormatter.format(gameData.betAmount, { code: 'COINS' })}`, inline: true }
      );

    // Clear the existing 'rows' array
    rows.length = 0;
    for (let i = 0; i < BOARD_SIZE ** 2; i += BOARD_SIZE) {
      const row = new ActionRowBuilder();
      for (let j = 0; j < BOARD_SIZE && i + j < BOARD_SIZE ** 2; j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`tictactoeuser_${i + j}`)
            .setLabel(gameData.board[i + j] === EMPTY_CELL ? '\u200b' : gameData.board[i + j])
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(gameData.board[i + j] !== EMPTY_CELL)
        );
      }
      rows.push(row);
    }

    await i.update({ embeds: [gameEmbed], components: rows });

    const winner = checkWinner(gameData.board);
    if (winner) {
      collector.stop();

      let rewardAmount = 0;
      if (winner === PLAYER_SYMBOL) {
        rewardAmount = gameData.betAmount * REWARD_MULTIPLIER;
        gameData.playerUser.balance += rewardAmount;
        gameData.opponentUser.balance -= gameData.betAmount;
      } else {
        rewardAmount = -gameData.betAmount;
        gameData.playerUser.balance -= gameData.betAmount;
        gameData.opponentUser.balance += gameData.betAmount * REWARD_MULTIPLIER;
      }

      await gameData.playerUser.save();
      await gameData.opponentUser.save();

      const winnerEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription(renderBoard(gameData.board, winner))
        .addFields(
          { name: 'Winner', value: winner === PLAYER_SYMBOL ? `${interaction.user.username} won!` : `${gameData.opponentUser.username} won!`, inline: true },
          { name: 'Reward', value: `${currencyFormatter.format(Math.abs(rewardAmount), { code: 'COINS' })}`, inline: true },
          { name: `${interaction.user.username}'s Balance`, value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true },
          { name: `${gameData.opponentUser.username}'s Balance`, value: `${currencyFormatter.format(gameData.opponentUser.balance, { code: 'COINS' })}`, inline: true }
        );

      await gameMessage.edit({ embeds: [winnerEmbed], components: [] });
    }

    if (gameData.board.every(cell => cell !== EMPTY_CELL)) {
      collector.stop();

      const drawEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription(renderBoard(gameData.board, gameData.currentPlayer))
        .addFields(
          { name: 'Result', value: 'It\'s a draw!', inline: true },
          { name: `${interaction.user.username}'s Balance`, value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true },
          { name: `${gameData.opponentUser.username}'s Balance`, value: `${currencyFormatter.format(gameData.opponentUser.balance, { code: 'COINS' })}`, inline: true }
        );

      await gameMessage.edit({ embeds: [drawEmbed], components: [] });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription('The game timed out due to inactivity. Better luck next time! 🕰️')
        .addFields(
          { name: `${interaction.user.username}'s Balance`, value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true },
          { name: `${gameData.opponentUser.username}'s Balance`, value: `${currencyFormatter.format(gameData.opponentUser.balance, { code: 'COINS' })}`, inline: true }
        );

      interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

function renderBoard(board, currentPlayer) {
  let boardString = '';
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY_CELL) {
      boardString += board[i];
    } else if (board[i] === currentPlayer) {
      boardString += board[i];
    } else {
      boardString += board[i];
    }
    if ((i + 1) % BOARD_SIZE === 0) {
      boardString += '\n';
    }
  }
  return boardString;
}

function checkWinner(board) {
  for (const [a, b, c] of winningCombinations) {
    if (board[a] !== EMPTY_CELL && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}