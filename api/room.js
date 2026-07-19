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

const rooms = globalThis.ticTacToeRooms || new Map();
globalThis.ticTacToeRooms = rooms;

module.exports = async function handler(request, response) {
  cleanOldRooms();

  if (request.method === "GET") {
    const code = String(request.query.code || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return sendError(response, 404, "Room not found.");
    }

    room.lastSeen = Date.now();
    return response.status(200).json(publicRoom(room));
  }

  if (request.method !== "POST") {
    return sendError(response, 405, "Use GET or POST.");
  }

  const body = await readBody(request);
  const action = body.action;

  if (action === "create") {
    return createRoom(response);
  }

  const code = String(body.code || "").toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return sendError(response, 404, "Room not found.");
  }

  room.lastSeen = Date.now();

  if (action === "join") {
    return joinRoom(response, room);
  }

  if (!isPlayer(room, body.player, body.token)) {
    return sendError(response, 403, "This room belongs to another player.");
  }

  if (action === "move") {
    return makeMove(response, room, body);
  }

  if (action === "newRound") {
    const scores = room.game.scores;
    room.game = createFreshGame();
    room.game.scores = scores;
    return response.status(200).json(publicRoom(room, body.player, body.token));
  }

  if (action === "resetScore") {
    room.game = createFreshGame();
    return response.status(200).json(publicRoom(room, body.player, body.token));
  }

  return sendError(response, 400, "Unknown room action.");
};

function createRoom(response) {
  const code = createRoomCode();
  const token = createToken();
  const room = {
    code,
    tokens: {
      X: token,
      O: ""
    },
    game: createFreshGame(),
    createdAt: Date.now(),
    lastSeen: Date.now()
  };

  rooms.set(code, room);
  return response.status(200).json(publicRoom(room, "X", token));
}

function joinRoom(response, room) {
  if (!room.tokens.O) {
    room.tokens.O = createToken();
  }

  return response.status(200).json(publicRoom(room, "O", room.tokens.O));
}

function makeMove(response, room, body) {
  const player = body.player;
  const index = Number(body.index);

  if (room.game.gameOver) {
    return sendError(response, 400, "Start a new round first.");
  }

  if (room.game.currentPlayer !== player) {
    return sendError(response, 400, "Wait for your turn.");
  }

  if (!Number.isInteger(index) || index < 0 || index > 8 || room.game.board[index]) {
    return sendError(response, 400, "Choose an empty square.");
  }

  applyMove(room.game, index);
  checkGameResult(room.game);

  return response.status(200).json(publicRoom(room, player, body.token));
}

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

function applyMove(game, index) {
  const player = game.currentPlayer;

  if (game.pieceHistory[player].length === 3) {
    const oldestPieceIndex = game.pieceHistory[player].shift();
    game.board[oldestPieceIndex] = "";
  }

  game.board[index] = player;
  game.pieceHistory[player].push(index);
}

function checkGameResult(game) {
  const winningLine = findWinningLine(game.board);

  if (winningLine) {
    game.gameOver = true;
    game.winningLine = winningLine;
    game.scores[game.currentPlayer] += 1;
    game.scores.Rounds += 1;
    return;
  }

  game.currentPlayer = game.currentPlayer === "X" ? "O" : "X";
  game.winningLine = [];
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

function publicRoom(room, player = "", token = "") {
  return {
    code: room.code,
    player,
    token,
    game: {
      ...room.game,
      players: {
        X: true,
        O: Boolean(room.tokens.O)
      }
    }
  };
}

function isPlayer(room, player, token) {
  return (player === "X" || player === "O") && room.tokens[player] === token;
}

function createRoomCode() {
  let code = "";

  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));

  return code;
}

function createToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function cleanOldRooms() {
  const twoHours = 2 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [code, room] of rooms) {
    if (now - room.lastSeen > twoHours) {
      rooms.delete(code);
    }
  }
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body ? JSON.parse(request.body) : {};
  }

  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk;
  }

  return rawBody ? JSON.parse(rawBody) : {};
}

function sendError(response, status, message) {
  return response.status(status).json({
    error: message
  });
}
