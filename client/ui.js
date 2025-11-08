// client/ui.js
if (!window.__UI_LOADED__) {
  window.__UI_LOADED__ = true;

  const gate = document.getElementById("usernameGate");
  const app = document.getElementById("appShell");
  const input = document.getElementById("username");
  const startBtn = document.getElementById("startBtn");

  const usersList = document.getElementById("usersOnline");
  const onlineCnt = document.getElementById("onlineCount");
  const whoDrawing = document.getElementById("whoDrawing");

  const colorPicker = document.getElementById("colorPicker");
  const widthRange = document.getElementById("widthRange");
  const widthLabel = document.getElementById("strokeWidthValue");

  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const saveBtn = document.getElementById("saveBtn");

  let connected = false;

  // Join
  startBtn.addEventListener("click", () => {
    if (connected) return;
    const name = (input.value || "").trim() || "Guest";
    joinWithName(name);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startBtn.click();
  });

  // Tools
  colorPicker.addEventListener("input", (e) => Canvas.setColor(e.target.value));
  widthRange.addEventListener("input", (e) => {
    widthLabel.textContent = e.target.value;
    Canvas.setWidth(+e.target.value);
  });

  undoBtn.onclick = () => Net.undo();
  redoBtn.onclick = () => Net.redo();
  clearBtn.onclick = () => Net.clear();
  saveBtn.onclick = () => {
    const c = document.getElementById("drawingCanvas");
    const a = document.createElement("a");
    a.download = `canvas-${Date.now()}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  // Tool buttons
  const toolBtns = document.querySelectorAll("[data-tool]");
  toolBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      toolBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      Canvas.setTool(btn.dataset.tool);
    });
  });

  window.UI = {
    setConnected(ok) {
      connected = ok;
      gate.classList.add("hidden");
      app.classList.remove("hidden");
    },
    canDraw() { return connected; },
    updateUsers(users) {
      usersList.innerHTML = "";
      onlineCnt.textContent = users.length;
      users.forEach(u => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="dot" style="background:${u.color}"></span>${u.name}`;
        usersList.appendChild(li);
      });
    },
    showWhoIsDrawing({ name, drawing }) {
      whoDrawing.textContent = drawing ? `${name} is drawing…` : "";
    }
  };
}
