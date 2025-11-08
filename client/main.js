// client/main.js
(() => {
  const canvas = document.getElementById("drawingCanvas");
  const shapeTools = new Set(["rect","ellipse","triangle","star","arrow","speech","cube"]);

  let drag = null;

  function xy(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener("mousedown", (e) => {
    if (!UI.canDraw()) return;
    if (!shapeTools.has(Canvas.tool)) return; // only shapes
    const { x, y } = xy(e);
    drag = { tool: Canvas.tool, x, y };
  });

  canvas.addEventListener("mousemove", (e) => {
    // Preview optional (skip for now)
  });

  window.addEventListener("mouseup", (e) => {
    if (!drag) return;
    const { x, y } = xy(e);
    const w = x - drag.x;
    const h = y - drag.y;
    if (Math.abs(w) > 1 || Math.abs(h) > 1) {
      Canvas.addShape({ shape: drag.tool, x: drag.x, y: drag.y, w, h });
    }
    drag = null;
  });

  // Keyboard Undo / Redo
  window.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); Net.undo(); }
    if (ctrl && (e.key.toLowerCase() === "y" || (ctrl && e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault(); Net.redo();
    }
  });
})();
