if (!window.__WS_LOADED__) {
  window.__WS_LOADED__ = true;

  const socket = io();
  window.socket = socket;

  // In-memory lookup for name/colors (to label cursors)
  const userMap = new Map(); // socketId -> {name,color}
  function refreshUsers(users) {
    userMap.clear();
    users.forEach(u => userMap.set(u.userId, { name: u.name, color: u.color }));
    UI.updateUsers(users);
  }

  window.Net = {
    beginStroke: s => socket.emit('stroke:begin', s),
    point: (x,y) => socket.emit('stroke:point', {x,y}),
    endStroke: () => socket.emit('stroke:end'),
    addShape: op => socket.emit('shape:add', op),
    addSticky: op => socket.emit('shape:add', { ...op, type: 'sticky' }), // piggyback as shape for compatibility
    clear: () => socket.emit('canvas:clear'),
    undo:  () => socket.emit('ops:undo'),
    redo:  () => socket.emit('ops:redo'),
    drawingStatus: drawing => socket.emit('drawing:status', { drawing }),
    // helper for cursor labels
    getUserName: (id) => userMap.get(id)?.name || ''
  };

  window.joinWithName = (name) => socket.emit('join', { name });

  // Initial bootstrap
  socket.on('initialState', ({ ops, me, users }) => {
    refreshUsers(users);
    Canvas.setColor(me.color);
    Canvas.replaceAll(ops);
    UI.setConnected(true);
  });

  socket.on('users:update', refreshUsers);

  // Streaming strokes
  socket.on('stroke:begin', ({ from, s }) => {
    Canvas.remoteBegin(from, s);
  });
  socket.on('stroke:point', ({ from, p }) => {
    Canvas.remotePoint(from, p);
  });

  // Ops
  socket.on('op:commit', (op) => Canvas.commit(op));
  socket.on('op:remove', ({ id }) => Canvas.removeById(id));
  socket.on('state:replace', (all) => Canvas.replaceAll(all));

  // Who's drawing indicator
  socket.on('drawing:status', (payload) => UI.showWhoIsDrawing(payload));
}
