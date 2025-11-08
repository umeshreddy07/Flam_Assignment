// client/websocket.js
// Guard against multiple loads
if (!window.__WS_LOADED__) {
  window.__WS_LOADED__ = true;

  // IMPORTANT: ensure <script src="/socket.io/socket.io.js"></script> is included before this file
  const socket = io({ transports: ['websocket', 'polling'] });
  window.socket = socket;

  // Keep a small map for labeling cursors / users (used by UI)
  const userMap = new Map(); // socketId -> { name, color }

  function refreshUsers(users) {
    // users: [{ userId, name, color }]
    userMap.clear();
    (users || []).forEach(u => userMap.set(u.userId, { name: u.name, color: u.color }));
    if (window.UI && UI.updateUsers) UI.updateUsers(users);
  }

  // Join after user clicks "Start Drawing" (UI calls this)
  window.joinWithName = (name) => socket.emit('join', { name });

  // Outgoing helpers used by canvas.js & UI
  window.Net = {
    beginStroke: (s) => socket.emit('stroke:begin', s),
    point: (x, y)   => socket.emit('stroke:point', { x, y }),
    endStroke: ()   => socket.emit('stroke:end'),

    addShape: (shapeOp) => socket.emit('shape:add', shapeOp),
    addSticky: (stickyOp) => socket.emit('shape:add', { ...stickyOp, type: 'sticky' }),

    clear: () => socket.emit('canvas:clear'),
    undo:  () => socket.emit('ops:undo'),
    redo:  () => socket.emit('ops:redo'),

    drawingStatus: (drawing) => socket.emit('drawing:status', { drawing }),

    // convenience (optional) for name lookups
    getUserName: (id) => userMap.get(id)?.name || '',
  };

  // ===== Bootstrap from server =====
  socket.on('initialState', ({ ops, me, users }) => {
    refreshUsers(users);
    if (window.Canvas) {
      Canvas.setColor(me?.color || '#000000');
      Canvas.replaceAll(ops || []);
    }
    if (window.UI && UI.setConnected) UI.setConnected(true);
  });

  // Presence
  socket.on('users:update', refreshUsers);

  // Live stroke streaming
  socket.on('stroke:begin', ({ from, s }) => {
    if (window.Canvas) Canvas.remoteBegin(from, s);
  });
  socket.on('stroke:point', ({ from, p }) => {
    if (window.Canvas) Canvas.remotePoint(from, p);
  });

  // Committed operations
  socket.on('op:commit', (op) => {
    if (window.Canvas) Canvas.commit(op);
  });
  socket.on('op:remove', ({ id }) => {
    if (window.Canvas) Canvas.removeById(id);
  });
  socket.on('state:replace', (allOps) => {
    if (window.Canvas) Canvas.replaceAll(allOps || []);
  });

  // Who is drawing (UI pill)
  socket.on('drawing:status', (payload) => {
    if (window.UI && UI.showWhoIsDrawing) UI.showWhoIsDrawing(payload);
  });
}
