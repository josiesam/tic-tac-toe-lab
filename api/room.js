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
  try {
    return await handleRequest(request, response);
  } catch (error) {
    return sendError(response, 500, error.message || "Room server error.");
  }
};

async function handleRequest(request, response) {
  if (!hasRedisStorage()) {
    cleanOldRooms();
  }

  if (request.method === "GET") {
    const code = String(request.query.code || "").toUpperCase();
    const room = await getRoom(code);

    if (!room) {
      return sendRoomNotFound(response);
    }

    room.lastSeen = Date.now();
    await saveRoom(room);
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
  const room = await getRoom(code);

  if (!room) {
    return sendRoomNotFound(response);
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
    await saveRoom(room);
    return response.status(200).json(publicRoom(room, body.player, body.token));
  }

  if (action === "resetScore") {
    room.game = createFreshGame();
    await saveRoom(room);
    return response.status(200).json(publicRoom(room, body.player, body.token));
  }

  return sendError(response, 400, "Unknown room action.");
}

async function createRoom(response) {
  const code = await createRoomCode();
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

  await saveRoom(room);
  return response.status(200).json(publicRoom(room, "X", token));
}

async function joinRoom(response, room) {
  if (!room.tokens.O) {
    room.tokens.O = createToken();
  }

  await saveRoom(room);
  return response.status(200).json(publicRoom(room, "O", room.tokens.O));
}

async function makeMove(response, room, body) {
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

  await saveRoom(room);
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

async function createRoomCode() {
  let code = "";

  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (await getRoom(code));

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

async function getRoom(code) {
  if (!code) {
    return null;
  }

  if (hasRedisStorage()) {
    const result = await redisCommand(["GET", roomKey(code)]);
    return result ? JSON.parse(result) : null;
  }

  return rooms.get(code) || null;
}

async function saveRoom(room) {
  room.lastSeen = Date.now();

  if (hasRedisStorage()) {
    await redisCommand(["SET", roomKey(room.code), JSON.stringify(room), "EX", 60 * 60 * 2]);
    return;
  }

  rooms.set(room.code, room);
}

async function redisCommand(command) {
  const redis = getRedisConfig();
  const response = await fetch(redis.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || "Redis request failed.");
  }

  return data.result;
}

function hasRedisStorage() {
  const redis = getRedisConfig();
  return Boolean(redis.url && redis.token);
}

function getRedisConfig() {
  return {
    url:
      process.env.TIC_TAC_TOC_KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL,
    token:
      process.env.TIC_TAC_TOC_KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.KV_REST_API_TOKEN
  };
}

function roomKey(code) {
  return `tic-tac-toe-room:${code}`;
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

function sendRoomNotFound(response) {
  const message = hasRedisStorage()
    ? "Room not found. Check the code and try again."
    : "Room not found. On Vercel, add Upstash Redis env vars so rooms do not disappear between requests.";

  return sendError(response, 404, message);
}
