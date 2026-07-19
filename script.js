const cells = document.querySelectorAll(".cell");
const statusText = document.querySelector("#status");
const roomInfo = document.querySelector("#roomInfo");
const roomCodeInput = document.querySelector("#roomCodeInput");
const localModeButton = document.querySelector("#localModeButton");
const createRoomButton = document.querySelector("#createRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const newRoundButton = document.querySelector("#newRoundButton");
const resetButton = document.querySelector("#resetButton");
const themeButton = document.querySelector("#themeButton");
const scoreX = document.querySelector("#scoreX");
const scoreO = document.querySelector("#scoreO");
const scoreRounds = document.querySelector("#scoreRounds");

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

let game = createFreshGame();
let mode = "local";
let roomCode = "";
let myPlayer = "";
let playerToken = "";
let pollTimer = null;

function createFreshGame() {
  return {
    board: ["", "", "", "", "", "", "", "", ""],
    currentPlayer: "X",
    gameOver: false,
    winningLine: [],
    pieceHistory: {
      X: [],
      O: []
    },
    scores: {
      X: 0,
      O: 0,
      Rounds: 0
    }
  };
}

function handleCellClick(event) {
  const index = Number(event.target.dataset.cell);

  if (mode === "online") {
    makeOnlineMove(index);
    return;
  }

  if (!canUseCell(index)) {
    return;
  }

  applyMove(game, index);
  checkGameResult(game);
  renderGame();
}

function canUseCell(index) {
  return !game.gameOver && game.board[index] === "";
}

function applyMove(targetGame, index) {
  const player = targetGame.currentPlayer;

  if (targetGame.pieceHistory[player].length === 3) {
    const oldestPieceIndex = targetGame.pieceHistory[player].shift();
    targetGame.board[oldestPieceIndex] = "";
  }

  targetGame.board[index] = player;
  targetGame.pieceHistory[player].push(index);
}

function checkGameResult(targetGame) {
  const winningLine = findWinningLine(targetGame.board);

  if (winningLine) {
    targetGame.gameOver = true;
    targetGame.winningLine = winningLine;
    targetGame.scores[targetGame.currentPlayer] += 1;
    targetGame.scores.Rounds += 1;
    return;
  }

  targetGame.currentPlayer = targetGame.currentPlayer === "X" ? "O" : "X";
  targetGame.winningLine = [];
}

function findWinningLine(board) {
  for (const line of winningLines) {
    const [a, b, c] = line;
    const lineHasSamePlayer = board[a] && board[a] === board[b] && board[a] === board[c];

    if (lineHasSamePlayer) {
      return line;
    }
  }

  return null;
}

function startNewRound() {
  if (mode === "online") {
    sendRoomAction("newRound");
    return;
  }

  const scores = game.scores;
  game = createFreshGame();
  game.scores = scores;
  renderGame();
}

function resetScore() {
  if (mode === "online") {
    sendRoomAction("resetScore");
    return;
  }

  game = createFreshGame();
  renderGame();
}

function renderGame() {
  cells.forEach((cell, index) => {
    const mark = game.board[index];

    cell.textContent = mark;
    cell.disabled = game.gameOver || (mode === "online" && !isMyTurn());
    cell.classList.remove("x", "o", "oldest", "win");

    if (mark) {
      cell.classList.add(mark.toLowerCase());
    }
  });

  game.winningLine.forEach((index) => {
    cells[index].classList.add("win");
  });

  markOldestPiece();
  updateScoreboard();
  updateStatus();
}

function markOldestPiece() {
  if (game.gameOver) {
    return;
  }

  const playerToShow = mode === "online" && myPlayer ? myPlayer : game.currentPlayer;
  const oldestPieceIndex = game.pieceHistory[playerToShow][0];

  if (game.pieceHistory[playerToShow].length === 3) {
    cells[oldestPieceIndex].classList.add("oldest");
  }
}

function updateScoreboard() {
  scoreX.textContent = game.scores.X;
  scoreO.textContent = game.scores.O;
  scoreRounds.textContent = game.scores.Rounds;
}

function updateStatus() {
  if (game.gameOver) {
    statusText.textContent = `${game.board[game.winningLine[0]]} wins this round!`;
    return;
  }

  if (mode === "online") {
    statusText.textContent = getOnlineTurnMessage();
    return;
  }

  statusText.textContent = getTurnMessage(game.currentPlayer);
}

function getTurnMessage(player) {
  const piecesUsed = game.pieceHistory[player].length;

  if (piecesUsed === 3) {
    return `Player ${player}'s turn. Your oldest piece will move to the square you choose.`;
  }

  const piecesLeft = 3 - piecesUsed;
  return `Player ${player}'s turn. Place a piece. ${piecesLeft} left before movement starts.`;
}

function getOnlineTurnMessage() {
  if (!myPlayer) {
    return "Create a code or join a room.";
  }

  if (game.players && !game.players.O) {
    return `Room ${roomCode}: waiting for Player O to join.`;
  }

  if (isMyTurn()) {
    return `Room ${roomCode}: your turn as Player ${myPlayer}.`;
  }

  return `Room ${roomCode}: waiting for Player ${game.currentPlayer}.`;
}

function isMyTurn() {
  return mode === "online" && myPlayer === game.currentPlayer && !game.gameOver;
}

async function createRoom() {
  try {
    const data = await roomRequest({ action: "create" });
    enterOnlineRoom(data);
    updateRoomInfo(`Share code ${roomCode} with your friend. You are Player X.`);
  } catch (error) {
    updateRoomInfo(error.message);
  }
}

async function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase();

  if (!code) {
    updateRoomInfo("Type a room code first.");
    return;
  }

  try {
    const data = await roomRequest({ action: "join", code });
    enterOnlineRoom(data);
    updateRoomInfo(`Joined room ${roomCode}. You are Player ${myPlayer}.`);
  } catch (error) {
    updateRoomInfo(error.message);
  }
}

function enterOnlineRoom(data) {
  mode = "online";
  game = data.game;
  roomCode = data.code;
  myPlayer = data.player;
  playerToken = data.token;
  roomCodeInput.value = roomCode;
  localModeButton.classList.remove("active");
  createRoomButton.classList.add("active");
  window.history.replaceState(null, "", `?room=${roomCode}`);
  startPolling();
  renderGame();
}

function enterLocalMode() {
  mode = "local";
  roomCode = "";
  myPlayer = "";
  playerToken = "";
  stopPolling();
  window.history.replaceState(null, "", window.location.pathname);
  localModeButton.classList.add("active");
  createRoomButton.classList.remove("active");
  updateRoomInfo("Local game: two players use this board.");
  renderGame();
}

async function makeOnlineMove(index) {
  if (!canUseCell(index)) {
    return;
  }

  if (!isMyTurn()) {
    updateRoomInfo("Wait for your turn.");
    return;
  }

  try {
    const data = await roomRequest({
      action: "move",
      code: roomCode,
      player: myPlayer,
      token: playerToken,
      index
    });
    game = data.game;
    renderGame();
  } catch (error) {
    updateRoomInfo(error.message);
  }
}

async function sendRoomAction(action) {
  try {
    const data = await roomRequest({
      action,
      code: roomCode,
      player: myPlayer,
      token: playerToken
    });
    game = data.game;
    renderGame();
  } catch (error) {
    updateRoomInfo(error.message);
  }
}

async function roomRequest(body) {
  const response = await fetch("/api/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Room request failed.");
  }

  return data;
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(loadRoom, 1200);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function loadRoom() {
  if (mode !== "online" || !roomCode) {
    return;
  }

  try {
    const response = await fetch(`/api/room?code=${roomCode}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Room not found.");
    }

    game = data.game;
    renderGame();
  } catch (error) {
    updateRoomInfo(error.message);
  }
}

function updateRoomInfo(message) {
  roomInfo.textContent = message;
}

function toggleTheme() {
  document.body.classList.toggle("theme-sunset");
}

function loadRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");

  if (code) {
    roomCodeInput.value = code.toUpperCase();
    updateRoomInfo(`Room code ${code.toUpperCase()} is ready to join.`);
  }
}

cells.forEach((cell) => {
  cell.addEventListener("click", handleCellClick);
});

localModeButton.addEventListener("click", enterLocalMode);
createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
newRoundButton.addEventListener("click", startNewRound);
resetButton.addEventListener("click", resetScore);
themeButton.addEventListener("click", toggleTheme);

loadRoomCodeFromUrl();
renderGame();
