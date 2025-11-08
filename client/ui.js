if (!window.__UI_LOADED__) {
  window.__UI_LOADED__ = true;

  const gate     = document.getElementById('usernameGate');
  const app      = document.getElementById('appShell');
  const conn     = document.getElementById('connection-status');
  const input    = document.getElementById('username');
  const startBtn = document.getElementById('startBtn');

  const colorPicker  = document.getElementById('colorPicker');
  const widthRange   = document.getElementById('widthRange');
  const widthLabel   = document.getElementById('strokeWidthValue');

  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn= document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');

  const usersList = document.getElementById('usersOnline');
  const onlineCount = document.getElementById('onlineCount');
  const whoDrawing = document.getElementById('whoDrawing');

  const themeToggle = document.getElementById('themeToggle');
  const themeToggleInline = document.getElementById('themeToggleInline');

  let connected = false;

  // Theme
  function setTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    const isDark = mode === 'dark';
    if (themeToggle) themeToggle.checked = isDark;
    if (themeToggleInline) themeToggleInline.checked = isDark;
    localStorage.setItem('cc-theme', mode);
  }
  const saved = localStorage.getItem('cc-theme');
  setTheme(saved || 'light');

  function toggleTheme(checked) { setTheme(checked ? 'dark' : 'light'); }
  themeToggle?.addEventListener('change', (e)=> toggleTheme(e.target.checked));
  themeToggleInline?.addEventListener('change', (e)=> toggleTheme(e.target.checked));

  // Start/join
  startBtn?.addEventListener('click', () => {
    if (connected) return;
    const name = (input?.value || '').trim() || 'Guest';
    window.joinWithName?.(name);
    conn?.classList.remove('hidden');
  });
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') startBtn.click(); });

  // Controls
  colorPicker?.addEventListener('input', (e) => { window.Canvas?.setColor(e.target.value); });
  widthRange?.addEventListener('input', (e) => {
    const v = +e.target.value; if (widthLabel) widthLabel.textContent = v; window.Canvas?.setWidth(v);
  });

  undoBtn?.addEventListener('click', () => window.Net?.undo());
  redoBtn?.addEventListener('click', () => window.Net?.redo());
  clearBtn?.addEventListener('click', () => window.Net?.clear());
  saveBtn?.addEventListener('click', () => {
    const c = document.getElementById('drawingCanvas');
    const link = document.createElement('a');
    link.download = `canvas-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  });

  window.UI = {
    setConnected(ok) {
      connected = ok;
      conn?.classList.add('hidden');
      gate?.classList.add('hidden');
      app?.classList.remove('hidden');
    },
    canDraw() { return connected; },
    updateUsers(users) {
      if (!usersList || !onlineCount) return;
      usersList.innerHTML = '';
      onlineCount.textContent = users.length;
      users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'user-item';
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.style.background = u.color;
        li.appendChild(avatar);
        const label = document.createElement('div');
        label.textContent = u.name;
        li.appendChild(label);
        usersList.appendChild(li);
      });
    },
    showWhoIsDrawing({ name, drawing }) {
      if (!whoDrawing) return;
      whoDrawing.textContent = drawing ? `${name} is drawing…` : '';
    }
  };
}
