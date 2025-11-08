(() => {
  // Tools toggle
  const allToolBtns = document.querySelectorAll('[data-tool]');
  function activate(btn) {
    allToolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Canvas.setTool(btn.dataset.tool);
  }
  allToolBtns.forEach(btn => btn.addEventListener('click', () => activate(btn)));

  // Maintain width label on load
  const widthRange = document.getElementById('widthRange');
  const widthLabel = document.getElementById('strokeWidthValue');
  if (widthRange && widthLabel) widthLabel.textContent = widthRange.value;

  // Room badge (basic support via ?room=)
  const badge = document.getElementById('roomBadge');
  const params = new URLSearchParams(location.search);
  const room = params.get('room') || 'lobby';
  if (badge) badge.textContent = `Room: ${room}`;
  // NOTE: backend would need per-room join; we keep label only to avoid server change.

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); Net.undo(); }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); Net.redo(); }
  });
})();
