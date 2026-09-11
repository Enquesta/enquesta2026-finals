const express = require("express");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
app.use(express.static(path.join(__dirname, "..")));
app.use(express.static("public"));


// ── Buzz answers (existing) ──────────────────────────────────────────────────
let answers = [];

// ── Bid pot state ────────────────────────────────────────────────────────────
let potState = {
  names: ['Team 1', 'Team 2', 'Team 3'],   // edit team names here
  pots:  [200, 200, 200],
  changed: undefined
};

// Signal all clients to reset crossword state on fresh server start
let serverStartTime = Date.now();

io.on("connection", (socket) => {
  // Tell the newly connected client what time the server started
  // so it can clear stale crossword state from a previous session
  socket.emit("serverStart", serverStartTime);

  // ── Existing buzz round ────────────────────────────────────────────────────
  socket.on("submitAnswer", (data) => {
    if (answers.find(a => a.team === data.team)) return;
    data.time = Date.now();
    answers.push(data);
    answers.sort((a, b) => a.time - b.time);
    io.emit("updateBoard", answers);
  });

  socket.on("reset", () => {
    answers = [];
    io.emit("updateBoard", answers);
  });

  // ── Bid pot round ──────────────────────────────────────────────────────────

  // Admin requests current state on load
  socket.on("getPots", () => {
    socket.emit("potUpdate", potState);
  });

  // Admin sends updated pots
  // data = { names: [...], pots: [...], changed: teamIndex }
  socket.on("setPots", (data) => {
    potState = data;
    io.emit("potUpdate", potState);   // broadcast to all clients (including main display)
  });

  // Convenience: reset pots to 200 each
  socket.on("resetPots", () => {
    potState = {
      names: potState.names,
      pots: potState.names.map(() => 200),
      changed: undefined
    };
    io.emit("potUpdate", potState);
  });

});

http.listen(3000, '0.0.0.0', () => {
  console.log("Server running on port 3000");
});
