// client/canvas.js
// Guard against multiple loads
if (!window.__CANVAS_LOADED__) {
  window.__CANVAS_LOADED__ = true;

  const canvas = document.getElementById('drawingCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // === HiDPI & initial sizing ===
  const DPR = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    // Set backing store size
    canvas.width = Math.max(1, Math.floor(rect.width * DPR));
    canvas.height = Math.max(1, Math.floor(rect.height * DPR));
    // Draw in CSS pixels using a transform
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true;
    redrawAll();
  }

  // Resize when element changes AND once at boot
  new ResizeObserver(resizeCanvas).observe(canvas);
  // Fallback for environments that don’t trigger ResizeObserver
  window.addEventListener('load', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);

  // ===== Client state =====
  let myColor = '#000000';
  let tool = 'pen';            // 'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser' | shapes...
  let lineW = 4;

  // Authoritative committed operations (from server or our own commits)
  // Op: { id, type: 'stroke'|'shape'|'sticky', points?, color, width, tool, ... }
  let ops = [];

  // Live remote strokes to render smoothly while streaming
  const remoteLive = new Map(); // socketId -> {points:[], color, width, tool}

  // Local freehand buffering
  let isDrawing = false;
  let pending = [];          // local points not yet flushed

  // ===== Public API exposed to other scripts =====
  window.Canvas = {
    // tool/color/width setters used by UI
    get tool() { return tool; },
    setTool: (t) => { tool = t; },
    setWidth: (w) => { lineW = Math.max(1, +w || 1); },
    setColor: (c) => { myColor = c || '#000000'; },

    // server-driven state flows
    replaceAll: (all) => { ops = (all || []).map(o => ({ ...o })); redrawAll(); },
    commit: (op) => { ops.push(op); drawOp(op); },
    removeById: (id) => { ops = ops.filter(o => o.id !== id); redrawAll(); },

    // live remote streams
    remoteBegin,
    remotePoint,

    // shapes / stickies from UI (we draw locally and also send)
    addShape,
    addSticky,
  };

  // ===== Drawing primitives =====
  function drawOp(op) {
    if (!op) return;
    if (op.type === 'stroke') {
      pathStroke(op.points || [], op.color, op.width, op.tool);
    } else if (op.type === 'shape') {
      drawShape(op);
    } else if (op.type === 'sticky') {
      drawSticky(op);
    }
  }

  function redrawAll() {
    // Clear full canvas (in device pixels)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Repaint all committed ops
    for (const op of ops) drawOp(op);

    // Paint live remote strokes on top for smoothness
    remoteLive.forEach(s => {
      if ((s.points || []).length > 1) {
        pathStroke(s.points, s.color, s.width, s.tool);
      } else if ((s.points || []).length === 1) {
        // draw a dot for single-point press
        const p = s.points[0];
        pathStroke([p, { x: p.x + 0.01, y: p.y + 0.01 }], s.color, s.width, s.tool);
      }
    });
  }

  function compositeFor(toolName) {
    if (toolName === 'eraser') return 'destination-out';
    if (toolName === 'highlighter') return 'multiply';
    return 'source-over';
  }

  function pathStroke(points, color, width, toolName) {
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = compositeFor(toolName);
    ctx.strokeStyle = color || '#000';
    // Basic pen families feel
    let sw = Math.max(1, +width || 1);
    if (toolName === 'pencil') sw = Math.max(1, Math.round(sw * 0.7));
    if (toolName === 'marker') sw = Math.round(sw * 1.8);
    if (toolName === 'highlighter') sw = Math.round(sw * 2.2);
    ctx.lineWidth = sw;

    ctx.beginPath();
    if (points.length === 1) {
      const p = points[0];
      // tiny segment to show a dot
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
    } else {
      // Smoothed quadratic path
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShape(op) {
    const { shape, x, y, w, h, color, width } = op;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color || myColor;
    ctx.lineWidth = Math.max(1, +width || lineW);
    ctx.beginPath();

    if (shape === 'rect') {
      ctx.strokeRect(x, y, w, h);
    } else if (shape === 'ellipse') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'triangle') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.stroke();
    } else if (shape === 'cube') {
      const d = Math.min(Math.abs(w), Math.abs(h)) * 0.25;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeRect(x + d, y - d, w, h);
      ctx.moveTo(x, y); ctx.lineTo(x + d, y - d);
      ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d);
      ctx.moveTo(x, y + h); ctx.lineTo(x + d, y + h - d);
      ctx.moveTo(x + w, y + h); ctx.lineTo(x + w + d, y + h - d);
      ctx.stroke();
    } else if (shape === 'star') {
      const cx = x + w / 2, cy = y + h / 2;
      const R = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const r = R * 0.5; const spikes = 5;
      let rot = Math.PI / 2 * 3; const step = Math.PI / spikes;
      ctx.moveTo(cx, cy - R);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * R, cy + Math.sin(rot) * R); rot += step;
        ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r); rot += step;
      }
      ctx.closePath(); ctx.stroke();
    } else if (shape === 'arrow') {
      const head = Math.min(Math.abs(w), Math.abs(h)) * 0.25;
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w - head, y + h / 2);
      ctx.lineTo(x + w - head, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - head, y + h);
      ctx.lineTo(x + w - head, y + h / 2);
      ctx.lineTo(x, y + h / 2);
      ctx.stroke();
    } else if (shape === 'speech') {
      const r = Math.min(Math.abs(w), Math.abs(h)) * 0.15;
      roundRect(ctx, x, y, w, h, r);
      ctx.moveTo(x + w * 0.25, y + h);
      ctx.lineTo(x + w * 0.35, y + h + r);
      ctx.lineTo(x + w * 0.45, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(Math.abs(r || 0), Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSticky(op) {
    // Simple sticky note: pale background, text
    const { x, y, w = 160, h = 120, text = 'Note', color = '#fffa9e' } = op;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#111';
    ctx.font = '14px Inter, system-ui, sans-serif';
    wrapText(text, x + 8, y + 22, w - 16, 18);
    ctx.restore();
  }

  function wrapText(str, x, y, maxW, lh) {
    const words = (str || '').split(/\s+/);
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, y);
        line = words[i];
        y += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  }

  // ===== Remote streaming handlers =====
  function remoteBegin(from, s) {
    remoteLive.set(from, { ...s, points: [] });
    // also redraw to ensure canvas shows dot if pointerdown without move
    redrawAll();
  }
  function remotePoint(from, p) {
    const s = remoteLive.get(from);
    if (!s) return;
    s.points.push(p);
    // draw last segment for smoothness
    pathStroke(s.points.slice(-2), s.color, s.width, s.tool);
  }

  // ===== Local freehand drawing =====
  function startFreehand(x, y) {
    isDrawing = true;
    pending = [{ x, y }];
    Net.drawingStatus(true);
    Net.beginStroke({ color: myColor, width: lineW, tool });
    // draw dot immediately so users see a mark even before server echo
    pathStroke([{ x, y }, { x: x + 0.01, y: y + 0.01 }], myColor, lineW, tool);
    flushLoop();
  }

  function moveFreehand(x, y) {
    if (!isDrawing) return;
    pending.push({ x, y });
  }

  function endFreehand() {
    if (!isDrawing) return;
    isDrawing = false;
    flushPoints(true);
    Net.endStroke();
    Net.drawingStatus(false);
  }

  function flushLoop() {
    if (!isDrawing) return;
    flushPoints(false);
    requestAnimationFrame(flushLoop);
  }

  // Push points to server regularly and render locally
  let lastFlush = 0;
  function flushPoints(force) {
    if (!pending.length) return;
    const now = performance.now();

    // local render: only the last segment for smoothness
    if (pending.length >= 2) {
      const seg = pending.slice(-2);
      pathStroke(seg, myColor, lineW, tool);
    }

    if (force || now - lastFlush > 16) {
      const toSend = pending.splice(0);
      for (const p of toSend) Net.point(p.x, p.y);
      lastFlush = now;
    }
  }

  // ===== Shapes / Stickies public helpers (local draw + send) =====
  function addShape({ shape, x, y, w, h }) {
    const op = { type: 'shape', shape, x, y, w, h, color: myColor, width: lineW };
    // Draw locally for instant feedback
    drawShape(op);
    // Send to server for authoritative commit
    Net.addShape(op);
  }

  function addSticky({ x, y, text, color }) {
    const op = { type: 'sticky', x, y, w: 160, h: 120, text, color: color || '#fffa9e' };
    drawSticky(op);
    Net.addSticky(op);
  }

  // ===== Pointer & touch wiring (freehand only here) =====
  function getXY(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Only handle freehand here; shapes are handled by main.js which calls Canvas.addShape
  canvas.addEventListener('mousedown', (e) => {
    if (!window.UI || !UI.canDraw?.()) return;
    const shapeTools = ['rect', 'ellipse', 'triangle', 'cube', 'star', 'arrow', 'speech'];
    if (shapeTools.includes(tool)) return; // shapes managed by main.js
    const { x, y } = getXY(e);
    startFreehand(x, y);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const { x, y } = getXY(e);
    moveFreehand(x, y);
  });

  window.addEventListener('mouseup', endFreehand);

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!window.UI || !UI.canDraw?.()) return;
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    const { x, y } = getXY({ clientX: t.clientX, clientY: t.clientY });
    startFreehand(x, y);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing || e.touches.length === 0) return;
    const t = e.touches[0];
    const { x, y } = getXY({ clientX: t.clientX, clientY: t.clientY });
    moveFreehand(x, y);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    e.preventDefault();
    endFreehand();
  }, { passive: false });

  // Final initial paint
  resizeCanvas();
}
