const cells = document.querySelectorAll(".cell");
const statusText = document.querySelector("#status");
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
  [2, 4, 6],
];

let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameOver = false;
let pieceHistory = {
  X: [],
  O: [],
};
let scores = {
  X: 0,
  O: 0,
  Rounds: 0,
};

function handleCellClick(event) {
  const cell = event.target;
  const index = Number(cell.dataset.cell);

  if (board[index] !== "" || gameOver) {
    return;
  }

  makeMove(index);
  checkGameResult();
}

function makeMove(index) {
  if (pieceHistory[currentPlayer].length === 3) {
    const oldestPieceIndex = pieceHistory[currentPlayer].shift();
    board[oldestPieceIndex] = "";
  }

  board[index] = currentPlayer;
  pieceHistory[currentPlayer].push(index);
  renderBoard();
}

function checkGameResult() {
  const winningLine = findWinningLine();

  if (winningLine) {
    finishRound(`${currentPlayer} wins this round!`, winningLine);
    scores[currentPlayer] += 1;
    scores.Rounds += 1;
    updateScoreboard();
    return;
  }

  switchPlayer();
}
function findWinningLine() {
  for (const line of winningLines) {
    const [a, b, c] = line;
    const lineHasSamePlayer =
      board[a] && board[a] === board[b] && board[a] === board[c];

    if (lineHasSamePlayer) {
      return line;
    }
  }

  return null;
}

function finishRound(message, winningLine = []) {
  gameOver = true;
  statusText.textContent = message;

  cells.forEach((cell) => {
    cell.disabled = true;
  });

  winningLine.forEach((index) => {
    cells[index].classList.add("win");
  });
}

function switchPlayer() {
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  statusText.textContent = getTurnMessage();
  markOldestPiece();
}

function startNewRound() {
  board = ["", "", "", "", "", "", "", "", ""];
  currentPlayer = "X";
  gameOver = false;
  pieceHistory = {
    X: [],
    O: [],
  };
  statusText.textContent = "Player X starts. Each player gets 3 pieces.";

  cells.forEach((cell) => {
    cell.textContent = "";
    cell.disabled = false;
    cell.classList.remove("x", "o", "win", "oldest");
  });
}

function resetScore() {
  scores = {
    X: 0,
    O: 0,
    Rounds: 0,
  };

  updateScoreboard();
  startNewRound();
}

function updateScoreboard() {
  scoreX.textContent = scores.X;
  scoreO.textContent = scores.O;
  scoreRounds.textContent = scores.Rounds;
}

function renderBoard() {
  cells.forEach((cell, index) => {
    const mark = board[index];

    cell.textContent = mark;
    cell.classList.remove("x", "o", "oldest");

    if (mark) {
      cell.classList.add(mark.toLowerCase());
    }
  });

  markOldestPiece();
}

function markOldestPiece() {
  cells.forEach((cell) => {
    cell.classList.remove("oldest");
  });

  if (pieceHistory[currentPlayer].length === 3 && !gameOver) {
    const oldestPieceIndex = pieceHistory[currentPlayer][0];
    cells[oldestPieceIndex].classList.add("oldest");
  }
}

function getTurnMessage() {
  const piecesUsed = pieceHistory[currentPlayer].length;

  if (piecesUsed === 3) {
    return `Player ${currentPlayer}'s turn. Your oldest piece will move to the square you choose.`;
  }

  const piecesLeft = 3 - piecesUsed;
  return `Player ${currentPlayer}'s turn. Place a piece. ${piecesLeft} left before movement starts.`;
}

function toggleTheme() {
  document.body.classList.toggle("theme-sunset");
}

cells.forEach((cell) => {
  cell.addEventListener("click", handleCellClick);
});

newRoundButton.addEventListener("click", startNewRound);
resetButton.addEventListener("click", resetScore);
themeButton.addEventListener("click", toggleTheme);
