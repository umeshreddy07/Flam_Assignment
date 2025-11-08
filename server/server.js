// server/server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/** ===== Authoritative state ===== **/
let users = new Map();                 // socketId -> {name,color}
let ops = [];                          // committed operations in order
let redoStack = [];                    // global redo stack
const liveStrokes = new Map();         // socketId -> {id, points, color, width, tool}

function randColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h} 80% 45%)`;
}

function opId() { return Math.random().toString(36).slice(2, 10); }

/** ===== Helpers ===== **/
function allUsers() {
  return [...users.entries()].map(([id, u]) => ({ userId: id, name: u.name, color: u.color }));
}

function commitOp(op) {
  ops.push(op);
  redoStack.length = 0; // any commit clears redo
}

/** ===== IO ===== **/
io.on('connection', (socket) => {
  // user joins with name
  socket.on('join', ({ name }) => {
    users.set(socket.id, { name: name?.trim() || 'Guest', color: randColor() });

    socket.emit('initialState', { ops, me: { id: socket.id, ...users.get(socket.id) }, users: allUsers() });
    io.emit('users:update', allUsers());
  });

  /** ---- live strokes ---- **/
  socket.on('stroke:begin', ({ color, width, tool }) => {
    const s = { id: opId(), type: 'stroke', points: [], color, width, tool: tool || 'pen' };
    liveStrokes.set(socket.id, s);
    socket.broadcast.emit('stroke:begin', { from: socket.id, s: { ...s, points: [] } });
  });

  socket.on('stroke:point', ({ x, y }) => {
    const s = liveStrokes.get(socket.id);
    if (!s) return;
    s.points.push({ x, y });
    // send only the latest point
    socket.broadcast.volatile.emit('stroke:point', { from: socket.id, p: { x, y } });
  });

  socket.on('stroke:end', () => {
    const s = liveStrokes.get(socket.id);
    if (!s) return;
    liveStrokes.delete(socket.id);

    // Commit full stroke (for perfect replay on new clients)
    commitOp(s);
    io.emit('op:commit', s);
    // also broadcast that this user stopped drawing
    const u = users.get(socket.id);
    if (u) io.emit('drawing:status', { userId: socket.id, name: u.name, drawing: false });
  });

  /** ---- shapes (single atomic op) ---- **/
  socket.on('shape:add', (shapeOp) => {
    const op = { id: opId(), type: 'shape', ...shapeOp };
    commitOp(op);
    io.emit('op:commit', op);
  });

  /** ---- clear ---- **/
  socket.on('canvas:clear', () => {
    ops.length = 0;
    redoStack.length = 0;
    io.emit('state:replace', ops);
  });

  /** ---- global undo / redo ---- **/
  socket.on('ops:undo', () => {
    if (!ops.length) return;
    const removed = ops.pop();
    redoStack.push(removed);
    io.emit('op:remove', { id: removed.id });
  });

  socket.on('ops:redo', () => {
    if (!redoStack.length) return;
    const restored = redoStack.pop();
    ops.push(restored);
    io.emit('op:commit', restored);
  });

  /** ---- drawing status ---- **/
  socket.on('drawing:status', ({ drawing }) => {
    const u = users.get(socket.id);
    if (u) socket.broadcast.emit('drawing:status', { userId: socket.id, name: u.name, drawing: !!drawing });
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    liveStrokes.delete(socket.id);
    io.emit('users:update', allUsers());
  });
});

/** static **/
app.use(express.static(path.join(__dirname, '../client')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../client/index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('listening on', PORT));
