// client/websocket.js
if (!window.__WS_LOADED__) {
  window.__WS_LOADED__ = true;

  const socket = io({ transports: ["websocket", "polling"] });
  window.socket = socket;

  const userMap = new Map(); // socketId -> { name, color }

  function setUsers(users) {
    userMap.clear();
    (users || []).forEach(u => userMap.set(u.userId, { name: u.name, color: u.color }));
    if (window.UI && UI.updateUsers) UI.updateUsers(users || []);
  }

  function readyCanvas(fn) {
    if (window.Canvas && typeof fn === "function") fn();
  }

  // Public API used by UI / Canvas
  window.joinWithName = (name) => socket.emit("join", { name });

  window.Net = {
    // Streaming
    beginStroke: (s) => socket.emit("stroke:begin", s),
    point: (x, y) => socket.emit("stroke:point", { x, y }),
    endStroke: () => socket.emit("stroke:end"),

    // Ops
    addShape: (op) => socket.emit("shape:add", op),
    addSticky: (op) => socket.emit("sticky:add", op),

    // History controls
    undo: () => socket.emit("ops:undo"),
    redo: () => socket.emit("ops:redo"),
    clear: () => socket.emit("canvas:clear"),

    // Indicators
    drawingStatus: (drawing) => socket.emit("drawing:status", { drawing }),

    // Chat
    sendChat: (text) => socket.emit("chat:msg", text),

    // helper
    getUserName: (id) => userMap.get(id)?.name || "",
  };

  /* Bootstrap */
  socket.on("initialState", ({ ops, me, users }) => {
    setUsers(users);
    readyCanvas(() => {
      Canvas.setColor?.(me?.color || "#222");
      Canvas.replaceAll?.(ops || []);
    });
    if (window.UI?.setConnected) UI.setConnected(true);
  });

  socket.on("users:update", setUsers);

  /* Streaming echoes to other clients for smoothness */
  socket.on("stroke:begin", ({ from, s }) => readyCanvas(() => Canvas.remoteBegin?.(from, s)));
  socket.on("stroke:point", ({ from, p }) => readyCanvas(() => Canvas.remotePoint?.(from, p)));
  socket.on("stroke:end", ({ from }) => {
    // Optional: if you add Canvas.remoteEnd, call it here
  });

  /* Authoritative ops */
  socket.on("op:commit", (op) => readyCanvas(() => Canvas.commit?.(op)));
  socket.on("op:remove", ({ id }) => readyCanvas(() => Canvas.removeById?.(id)));
  socket.on("state:replace", (allOps) => readyCanvas(() => Canvas.replaceAll?.(allOps)));

  /* Indicators */
  socket.on("drawing:status", payload => window.UI?.showWhoIsDrawing?.(payload));

  /* Connection banner (optional) */
  socket.on("connect", () => {
    const el = document.getElementById("connection-status");
    if (el) { el.style.display = "block"; el.textContent = "🟢 Connected"; }
  });
  socket.on("disconnect", () => {
    const el = document.getElementById("connection-status");
    if (el) { el.style.display = "block"; el.textContent = "🔴 Disconnected"; }
    window.UI?.setConnected?.(false);
  });
}
