// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "../client")));

function randomColor() {
  const colors = ["#ff6b6b","#6c5ce7","#00cec9","#fdcb6e","#e84393","#0984e3"];
  return colors[Math.floor(Math.random() * colors.length)];
}

/** Global canvas state (single room). If you want rooms later, key these by roomId */
let ops = [];               // committed operations [{id,type,...}]
let redoStack = [];         // undone ops to redo
const users = new Map();    // socketId -> { userId, name, color }
const liveStrokes = new Map(); // socketId -> { color, width, tool, points: [] }

io.on("connection", (socket) => {
  // join with username
  socket.on("join", ({ name }) => {
    const user = { userId: socket.id, name: (name||"Guest").slice(0,40), color: randomColor() };
    users.set(socket.id, user);

    // Send current state to this user
    io.to(socket.id).emit("initialState", { ops, me: user, users: [...users.values()] });
    io.emit("users:update", [...users.values()]);
  });

  /* ---------- Streaming freehand ---------- */
  socket.on("stroke:begin", (s) => {
    // start new live stroke buffer for this user
    liveStrokes.set(socket.id, { ...s, points: [] });
    socket.broadcast.emit("stroke:begin", { from: socket.id, s });
  });

  socket.on("stroke:point", (p) => {
    const cur = liveStrokes.get(socket.id);
    if (!cur) return;
    cur.points.push({ x: +p.x, y: +p.y });
    socket.broadcast.emit("stroke:point", { from: socket.id, p: { x: +p.x, y: +p.y } });
  });

  socket.on("stroke:end", () => {
    socket.broadcast.emit("stroke:end", { from: socket.id });

    const cur = liveStrokes.get(socket.id);
    if (cur && cur.points.length) {
      // Commit a single STROKE op
      const op = {
        id: Date.now() + "_" + Math.random().toString(16).slice(2),
        type: "stroke",
        tool: cur.tool,
        color: cur.color,
        width: cur.width,
        points: cur.points,
      };
      ops.push(op);
      redoStack.length = 0; // new branch -> clear redo
      io.emit("op:commit", op);
    }
    liveStrokes.delete(socket.id);
  });

  /* ---------- Shapes & stickies are single-shot ops ---------- */
  socket.on("shape:add", (op) => {
    const full = {
      ...op,
      id: Date.now() + "_" + Math.random().toString(16).slice(2),
      type: "shape",
    };
    ops.push(full);
    redoStack.length = 0;
    io.emit("op:commit", full);
  });

  socket.on("sticky:add", (op) => {
    const full = {
      ...op,
      id: Date.now() + "_" + Math.random().toString(16).slice(2),
      type: "sticky",
    };
    ops.push(full);
    redoStack.length = 0;
    io.emit("op:commit", full);
  });

  /* ---------- Undo / Redo / Clear ---------- */
  socket.on("ops:undo", () => {
    if (!ops.length) return;
    const removed = ops.pop();
    redoStack.push(removed);
    io.emit("op:remove", { id: removed.id });
  });

  socket.on("ops:redo", () => {
    if (!redoStack.length) return;
    const again = redoStack.pop();
    ops.push(again);
    io.emit("op:commit", again);
  });

  socket.on("canvas:clear", () => {
    ops = [];
    redoStack = [];
    io.emit("state:replace", []);
  });

  /* ---------- Indicators & chat (optional) ---------- */
  socket.on("drawing:status", ({ drawing }) => {
    const user = users.get(socket.id);
    io.emit("drawing:status", { drawing: !!drawing, name: user?.name || "Guest" });
  });

  socket.on("chat:msg", (text) => {
    const u = users.get(socket.id);
    io.emit("chat:msg", { name: u?.name || "Unknown", color: u?.color || "#888", text: String(text||"").slice(0,300), ts: Date.now() });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    liveStrokes.delete(socket.id);
    io.emit("users:update", [...users.values()]);
  });
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
