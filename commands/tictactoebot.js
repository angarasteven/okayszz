const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const currencyFormatter = require('currency-formatter');

const BOARD_SIZE = 3;
const EMPTY_CELL = '⬜';
const PLAYER_SYMBOL = '❌';
const BOT_SYMBOL = '⭕';
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoebot')
    .setDescription('Play a game of Tic Tac Toe against the bot!')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('The amount of coins to bet')
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

    const gameData = {
      board: Array(BOARD_SIZE ** 2).fill(EMPTY_CELL),
      currentPlayer: PLAYER_SYMBOL,
      playerUser: user,
      opponentUser: null,
      betAmount,
    };

    startGame(interaction, gameData);
  },
};

async function startGame(interaction, gameData) {
  const gameEmbed = new EmbedBuilder()
    .setTitle('Tic Tac Toe')
    .setDescription(renderBoard(gameData.board, gameData.currentPlayer))
    .addFields(
      { name: 'Your Symbol', value: PLAYER_SYMBOL, inline: true },
      { name: 'Opponent Symbol', value: BOT_SYMBOL, inline: true },
      { name: 'Bet Amount', value: `${currencyFormatter.format(gameData.betAmount, { code: 'COINS' })}`, inline: true }
    );

  const rows = [];
  for (let i = 0; i < BOARD_SIZE ** 2; i += BOARD_SIZE) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < BOARD_SIZE && i + j < BOARD_SIZE ** 2; j++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tictactoebot_${i + j}`)
          .setLabel(gameData.board[i + j] === EMPTY_CELL ? '\u200b' : gameData.board[i + j])
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(gameData.board[i + j] !== EMPTY_CELL)
      );
    }
    rows.push(row);
  }

  const gameMessage = await interaction.reply({ embeds: [gameEmbed], components: rows });

  const filter = (i) => i.customId.startsWith('tictactoebot_') && i.user.id === interaction.user.id;
  const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 * 5 }); // 5 minute timeout

  collector.on('collect', async (i) => {
    const cellIndex = parseInt(i.customId.split('_')[1]);
    if (gameData.board[cellIndex] !== EMPTY_CELL) return i.reply({ content: 'That cell is already taken! Try again, smartypants! 🤓', ephemeral: true });

    gameData.board[cellIndex] = gameData.currentPlayer;
    gameData.currentPlayer = gameData.currentPlayer === PLAYER_SYMBOL ? BOT_SYMBOL : PLAYER_SYMBOL;

    const gameEmbed = new EmbedBuilder()
      .setTitle('Tic Tac Toe')
      .setDescription(renderBoard(gameData.board, gameData.currentPlayer))
      .addFields(
        { name: 'Your Symbol', value: PLAYER_SYMBOL, inline: true },
        { name: 'Opponent Symbol', value: BOT_SYMBOL, inline: true },
        { name: 'Bet Amount', value: `${currencyFormatter.format(gameData.betAmount, { code: 'COINS' })}`, inline: true }
      );

    // Clear the existing 'rows' array
    rows.length = 0;
    for (let i = 0; i < BOARD_SIZE ** 2; i += BOARD_SIZE) {
      const row = new ActionRowBuilder();
      for (let j = 0; j < BOARD_SIZE && i + j < BOARD_SIZE ** 2; j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`tictactoebot_${i + j}`)
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
      } else {
        rewardAmount = -gameData.betAmount;
        gameData.playerUser.balance -= gameData.betAmount;
      }

      await gameData.playerUser.save();

      const winnerEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription(renderBoard(gameData.board, winner))
        .addFields(
          { name: 'Winner', value: winner === PLAYER_SYMBOL ? 'You won!' : 'You lost!', inline: true },
          { name: 'Reward', value: `${currencyFormatter.format(Math.abs(rewardAmount), { code: 'COINS' })}`, inline: true },
          { name: 'Balance', value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true }
        );

      return i.editReply({ embeds: [winnerEmbed], components: [] });
    }

    if (gameData.board.every(cell => cell !== EMPTY_CELL)) {
      collector.stop();

      const drawEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription(renderBoard(gameData.board, gameData.currentPlayer))
        .addFields(
          { name: 'Result', value: 'It\'s a draw!', inline: true },
          { name: 'Balance', value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true }
        );

      return i.editReply({ embeds: [drawEmbed], components: [] });
    }

    const botMove = getBotMove(gameData.board, BOT_SYMBOL);
    gameData.board[botMove] = BOT_SYMBOL;
    gameData.currentPlayer = PLAYER_SYMBOL;

    const botMoveEmbed = new EmbedBuilder()
      .setTitle('Tic Tac Toe')
      .setDescription(`The bot has made its move!\n\n${renderBoard(gameData.board, gameData.currentPlayer)}`)
      .addFields(
        { name: 'Your Symbol', value: PLAYER_SYMBOL, inline: true },
        { name: 'Opponent Symbol', value: BOT_SYMBOL, inline: true },
        { name: 'Bet Amount', value: `${currencyFormatter.format(gameData.betAmount, { code: 'COINS' })}`, inline: true }
      );

    // Clear the existing 'rows' array
    rows.length = 0;
    for (let i = 0; i < BOARD_SIZE ** 2; i += BOARD_SIZE) {
      const row = new ActionRowBuilder();
      for (let j = 0; j < BOARD_SIZE && i + j < BOARD_SIZE ** 2; j++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`tictactoebot_${i + j}`)
            .setLabel(gameData.board[i + j] === EMPTY_CELL ? '\u200b' : gameData.board[i + j])
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(gameData.board[i + j] !== EMPTY_CELL)
        );
      }
      rows.push(row);
    }

    await i.editReply({ embeds: [botMoveEmbed], components: rows });
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Tic Tac Toe')
        .setDescription('The game timed out due to inactivity. Better luck next time! 🕰️')
        .addFields(
          { name: 'Balance', value: `${currencyFormatter.format(gameData.playerUser.balance, { code: 'COINS' })}`, inline: true }
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

function getBotMove(board, symbol) {
  // Check for winning move
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY_CELL) {
      board[i] = symbol;
      if (checkWinner(board) === symbol) {
        board[i] = EMPTY_CELL;
        return i;
      }
      board[i] = EMPTY_CELL;
    }
  }

  // Check for blocking move
  const opponentSymbol = symbol === PLAYER_SYMBOL ? BOT_SYMBOL : PLAYER_SYMBOL;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY_CELL) {
      board[i] = opponentSymbol;
      if (checkWinner(board) === opponentSymbol) {
        board[i] = EMPTY_CELL;
        return i;
      }
      board[i] = EMPTY_CELL;
    }
  }

    // Take center or corner randomly
    const centerAndCorners = [0, 2, 4, 6, 8];
    const availableMoves = centerAndCorners.filter(move => board[move] === EMPTY_CELL);
    if (availableMoves.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableMoves.length);
      return availableMoves[randomIndex];
    }

    // Take any available cell
    for (let i = 0; i < board.length; i++) {
      if (board[i] === EMPTY_CELL) {
        return i;
      }
    }

    // This should never happen, but return a default value just in case
    return 0;
}
