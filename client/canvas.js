// client/canvas.js
if (!window.__CANVAS_LOADED__) {
  window.__CANVAS_LOADED__ = true;

  const canvas = document.getElementById("drawingCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const DPR = window.devicePixelRatio || 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    redrawAll();
  }
  window.addEventListener("resize", resize);

  let myColor = "#000";
  let tool = "pen";
  let lineW = 4;

  let ops = [];
  const live = new Map(); // userId -> live stroke in progress

  // Exported API
  window.Canvas = {
    setTool: (t) => (tool = t),
    setColor: (c) => (myColor = c),
    setWidth: (w) => (lineW = +w),
    setMyColor: (c) => (myColor = c),

    commit: (op) => {
      ops.push(op);
      drawOp(op);
    },
    removeById: (id) => {
      ops = ops.filter((o) => o.id !== id);
      redrawAll();
    },
    replaceAll: (all) => {
      ops = all.slice();
      redrawAll();
    },
  };

  function drawOp(op) {
    if (op.type === "stroke") {
      pathStroke(op.points, op.color, op.width, op.tool);
    } else if (op.type === "shape") {
      drawShape(op);
    }
  }

  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ops.forEach(drawOp);
    live.forEach((s) => pathStroke(s.points, s.color, s.width, s.tool));
  }

  function pathStroke(points, color, w, t) {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawShape(op) {
    const { shape, x, y, w, h, color, width } = op;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();

    if (shape === "rect") ctx.strokeRect(x, y, w, h);
    else if (shape === "ellipse") {
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    else if (shape === "triangle") {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.stroke();
    }
    else if (shape === "cube") {
      const d = Math.min(w, h) * 0.25;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeRect(x + d, y - d, w, h);
      ctx.moveTo(x, y);
      ctx.lineTo(x + d, y - d);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w + d, y - d);
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + d, y + h - d);
      ctx.moveTo(x + w, y + h);
      ctx.lineTo(x + w + d, y + h - d);
      ctx.stroke();
    }
    else if (shape === "star") {
      const cx = x + w / 2, cy = y + h / 2;
      const R = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const r = R * 0.5;
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / 5;
      ctx.moveTo(cx, cy - R);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(cx + Math.cos(rot) * R, cy + Math.sin(rot) * R);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
        rot += step;
      }
      ctx.closePath();
      ctx.stroke();
    }
    else if (shape === "arrow") {
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w - h * 0.3, y + h / 2);
      ctx.lineTo(x + w - h * 0.3, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - h * 0.3, y + h);
      ctx.lineTo(x + w - h * 0.3, y + h / 2);
      ctx.lineTo(x, y + h / 2);
      ctx.stroke();
    }
    else if (shape === "speech") {
      ctx.roundRect(x, y, w, h, 10);
      ctx.moveTo(x + w * 0.3, y + h);
      ctx.lineTo(x + w * 0.4, y + h + 12);
      ctx.lineTo(x + w * 0.5, y + h);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Incoming live strokes
  window.Canvas.remoteBegin = (from, s) => {
    live.set(from, { ...s, points: [] });
  };

  window.Canvas.remotePoint = (from, p) => {
    const s = live.get(from);
    if (!s) return;
    s.points.push(p);
    redrawAll();
  };

  // Local stroke handling
  let isDrawing = false;
  let pending = [];

  function startFreehand(x, y) {
    isDrawing = true;
    pending = [{ x, y }];
    Net.drawingStatus(true);
    Net.beginStroke({ color: myColor, width: lineW, tool });
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

  function flushPoints(force) {
    if (pending.length > 1) {
      pathStroke(pending.slice(-2), myColor, lineW, tool);
    }
    if (pending.length && (force || pending.length > 3)) {
      const pts = pending.splice(0);
      pts.forEach((p) => Net.point(p.x, p.y));
    }
  }

  function getXY(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("mousedown", (e) => {
    if (!UI.canDraw()) return;
    const { x, y } = getXY(e);
    startFreehand(x, y);
  });
  canvas.addEventListener("mousemove", (e) => moveFreehand(...Object.values(getXY(e))));
  window.addEventListener("mouseup", endFreehand);

  resize();
}
