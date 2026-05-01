import { GameAudio } from "./audio.js";
import { Game2048 } from "./game2048.js";
import {
  createPlayer,
  formatDuration,
  getLeaderboard,
  initials,
  loadState,
  recordGame,
  sanitizeName,
  saveState,
} from "./storage.js";

const directionsByKey = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
  w: "up",
  d: "right",
  s: "down",
  a: "left",
};

const resultLabels = {
  win: "胜利",
  loss: "结束",
  settle: "结算",
};

const elements = {
  menuScreen: document.querySelector("#menuScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  startButton: document.querySelector("#startButton"),
  quickPlayerButton: document.querySelector("#quickPlayerButton"),
  playerList: document.querySelector("#playerList"),
  playerForm: document.querySelector("#playerForm"),
  playerNameInput: document.querySelector("#playerNameInput"),
  menuLeaderboard: document.querySelector("#menuLeaderboard"),
  gameLeaderboard: document.querySelector("#gameLeaderboard"),
  menuMusicToggle: document.querySelector("#menuMusicToggle"),
  musicToggle: document.querySelector("#musicToggle"),
  volumeSlider: document.querySelector("#volumeSlider"),
  gameBoard: document.querySelector("#gameBoard"),
  currentPlayerLabel: document.querySelector("#currentPlayerLabel"),
  scoreValue: document.querySelector("#scoreValue"),
  bestValue: document.querySelector("#bestValue"),
  movesValue: document.querySelector("#movesValue"),
  maxTileValue: document.querySelector("#maxTileValue"),
  timeValue: document.querySelector("#timeValue"),
  gamesValue: document.querySelector("#gamesValue"),
  winsValue: document.querySelector("#winsValue"),
  historyTable: document.querySelector("#historyTable"),
  newGameButton: document.querySelector("#newGameButton"),
  settleButton: document.querySelector("#settleButton"),
  menuButton: document.querySelector("#menuButton"),
  resultModal: document.querySelector("#resultModal"),
  modalKicker: document.querySelector("#modalKicker"),
  modalTitle: document.querySelector("#modalTitle"),
  modalText: document.querySelector("#modalText"),
  modalActions: document.querySelector("#modalActions"),
};

let state = loadState();
let game = new Game2048(4);
let audio = new GameAudio(state.settings);
let tileElements = new Map();
let tileLayer = null;
let startTime = 0;
let timerId = 0;
let elapsedBeforePause = 0;
let settledThisRound = false;
let touchStart = null;

init();

function init() {
  buildBoard();
  bindEvents();
  syncSettingsUI();
  renderAll();
}

function bindEvents() {
  elements.startButton.addEventListener("click", () => startRound());
  elements.quickPlayerButton.addEventListener("click", () => {
    elements.playerNameInput.focus();
  });

  elements.playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlayer(elements.playerNameInput.value);
  });

  elements.playerList.addEventListener("click", (event) => {
    const playerButton = event.target.closest("[data-player-id]");

    if (!playerButton) {
      return;
    }

    state.activePlayerId = playerButton.dataset.playerId;
    persist();
    renderAll();
  });

  elements.newGameButton.addEventListener("click", () => startRound());
  elements.settleButton.addEventListener("click", () => settleRound("settle"));
  elements.menuButton.addEventListener("click", () => showMenu());
  elements.musicToggle.addEventListener("click", toggleMusic);
  elements.menuMusicToggle.addEventListener("click", toggleMusic);

  elements.volumeSlider.addEventListener("input", () => {
    state.settings.volume = Number(elements.volumeSlider.value) / 100;
    audio.setVolume(state.settings.volume);
    persist();
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = directionsByKey[key];

    if (!direction || elements.gameScreen.classList.contains("hidden") || !elements.resultModal.classList.contains("hidden")) {
      return;
    }

    event.preventDefault();
    runMove(direction);
  });

  elements.gameBoard.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  elements.gameBoard.addEventListener("touchend", (event) => {
    if (!touchStart) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 26) {
      return;
    }

    runMove(Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? "right" : "left") : (deltaY > 0 ? "down" : "up"));
  }, { passive: true });
}

function buildBoard() {
  elements.gameBoard.innerHTML = "";

  for (let index = 0; index < 16; index += 1) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    elements.gameBoard.appendChild(cell);
  }

  tileLayer = document.createElement("div");
  tileLayer.className = "tile-layer";
  elements.gameBoard.appendChild(tileLayer);
}

async function startRound() {
  await audio.unlock();

  game = new Game2048(4);
  tileElements.forEach((element) => element.remove());
  tileElements = new Map();
  elapsedBeforePause = 0;
  settledThisRound = false;
  startTimer();
  renderTiles();
  renderGameStats();
  showGame();
  audio.startMusic();
}

function runMove(direction) {
  const result = game.move(direction);

  if (!result.moved) {
    bumpBoard();
    return;
  }

  renderTiles();
  renderGameStats();
  audio.playMove();

  if (result.mergedValues.length) {
    audio.playMerge(Math.max(...result.mergedValues));
  }

  if (result.won && !game.keepPlaying) {
    stopTimer();
    audio.playWin();
    showResultModal("win");
    return;
  }

  if (result.over) {
    stopTimer();
    audio.playGameOver();
    showResultModal("loss");
  }
}

function settleRound(type) {
  if (settledThisRound) {
    showMenu();
    return;
  }

  const result = type === "win" ? "胜利" : resultLabels[type] || "结算";
  state = recordGame(state, state.activePlayerId, {
    score: game.score,
    maxTile: game.getMaxTile(),
    moves: game.moves,
    duration: getElapsed(),
    result,
  });
  settledThisRound = true;
  persist();
  renderAll();
}

function showResultModal(type) {
  const isWin = type === "win";
  const isLoss = type === "loss";
  const maxTile = game.getMaxTile();

  elements.modalKicker.textContent = isWin ? "2048" : "Result";
  elements.modalTitle.textContent = isWin ? "达成 2048" : "本局结束";
  elements.modalText.textContent = `积分 ${game.score}，最大方块 ${maxTile}，用时 ${formatDuration(getElapsed())}。`;
  elements.modalActions.innerHTML = "";

  if (isWin) {
    elements.modalActions.append(
      createModalButton("继续挑战", () => {
        game.continueAfterWin();
        startTimer();
        hideModal();
        renderGameStats();
      }),
      createModalButton("结算胜局", () => {
        settleRound("win");
        hideModal();
        showMenu();
      }, true)
    );
  } else if (isLoss) {
    elements.modalActions.append(
      createModalButton("再来一局", () => {
        settleRound("loss");
        hideModal();
        startRound();
      }, true),
      createModalButton("返回菜单", () => {
        settleRound("loss");
        hideModal();
        showMenu();
      })
    );
  }

  elements.resultModal.classList.remove("hidden");
}

function createModalButton(label, handler, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "primary-button" : "secondary-button";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function hideModal() {
  elements.resultModal.classList.add("hidden");
}

function showGame() {
  elements.menuScreen.classList.add("hidden");
  elements.gameScreen.classList.remove("hidden");
  renderGameStats();
}

function showMenu() {
  stopTimer();
  hideModal();
  elements.gameScreen.classList.add("hidden");
  elements.menuScreen.classList.remove("hidden");
  renderAll();
}

function renderAll() {
  renderPlayers();
  renderLeaderboards();
  renderHistory();
  renderGameStats();
}

function renderPlayers() {
  elements.playerList.innerHTML = "";

  state.players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `player-option${player.id === state.activePlayerId ? " is-active" : ""}`;
    button.dataset.playerId = player.id;
    button.innerHTML = `
      <span class="avatar" style="background:${player.color}">${initials(player.name)}</span>
      <span class="player-meta">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="player-sub">${player.stats.games} 局 / ${player.stats.wins} 胜</span>
      </span>
      <span class="player-score">${player.stats.bestScore}</span>
    `;
    elements.playerList.appendChild(button);
  });
}

function renderLeaderboards() {
  const ranked = getLeaderboard(state, 8);
  const html = ranked.length
    ? ranked.map((player, index) => `
      <div class="rank-row">
        <span class="rank-index">${index + 1}</span>
        <span class="rank-name">${escapeHtml(player.name)}</span>
        <span class="rank-score">${player.stats.bestScore}</span>
      </div>
    `).join("")
    : `<p class="empty-state">暂无排行</p>`;

  elements.menuLeaderboard.innerHTML = html;
  elements.gameLeaderboard.innerHTML = html;
}

function renderHistory() {
  if (!state.games.length) {
    elements.historyTable.innerHTML = `<tr><td colspan="4">暂无记录</td></tr>`;
    return;
  }

  elements.historyTable.innerHTML = state.games.slice(0, 7).map((item) => `
    <tr>
      <td>${escapeHtml(item.playerName)}</td>
      <td>${item.score}</td>
      <td>${item.maxTile}</td>
      <td>${escapeHtml(item.result)}</td>
    </tr>
  `).join("");
}

function renderGameStats() {
  const player = getActivePlayer();
  const currentBest = player ? Math.max(player.stats.bestScore, game.score) : game.score;
  const maxTile = game.getMaxTile();

  elements.currentPlayerLabel.textContent = player ? player.name : "本地玩家";
  elements.scoreValue.textContent = game.score;
  elements.bestValue.textContent = currentBest;
  elements.movesValue.textContent = game.moves;
  elements.maxTileValue.textContent = maxTile;
  elements.timeValue.textContent = formatDuration(getElapsed());
  elements.gamesValue.textContent = player?.stats.games ?? 0;
  elements.winsValue.textContent = player?.stats.wins ?? 0;
}

function renderTiles() {
  const currentTiles = game.getTiles();
  const currentIds = new Set(currentTiles.map((tile) => tile.id));
  const mergeTargets = new Map();

  currentTiles.forEach((tile) => {
    if (!tile.mergedFrom) {
      return;
    }

    tile.mergedFrom.forEach((source) => {
      mergeTargets.set(source.id, { row: tile.row, col: tile.col });
    });
  });

  tileElements.forEach((element, id) => {
    if (currentIds.has(id)) {
      return;
    }

    const target = mergeTargets.get(id);

    if (target) {
      setTilePosition(element, target);
    }

    element.classList.add("tile-gone");
    window.setTimeout(() => element.remove(), 140);
    tileElements.delete(id);
  });

  currentTiles.forEach((tile) => {
    let element = tileElements.get(tile.id);

    if (!element) {
      element = document.createElement("div");
      element.className = "tile";
      tileLayer.appendChild(element);
      tileElements.set(tile.id, element);
    }

    element.textContent = tile.value;
    element.dataset.value = String(tile.value);
    element.dataset.digits = String(tile.value).length;
    element.className = "tile";

    if (tile.value > 2048) {
      element.classList.add("tile-super");
    }

    if (tile.isNew) {
      element.classList.add("tile-new");
    }

    if (tile.mergedFrom) {
      element.classList.add("tile-merged");
    }

    setTilePosition(element, tile);
  });
}

function setTilePosition(element, tile) {
  element.style.setProperty("--tile-transform", `translate(${positionExpression(tile.col)}, ${positionExpression(tile.row)})`);
  element.style.zIndex = String(tile.value);
}

function positionExpression(index) {
  if (!index) {
    return "0";
  }

  const gaps = Array.from({ length: index }, () => "var(--board-gap)").join(" + ");
  return `calc(${index * 100}% + ${gaps})`;
}

function addPlayer(name) {
  const cleanName = sanitizeName(name);

  if (!cleanName) {
    elements.playerNameInput.focus();
    return;
  }

  const player = createPlayer(cleanName, state.players.length);
  state.players.push(player);
  state.activePlayerId = player.id;
  elements.playerNameInput.value = "";
  persist();
  renderAll();
}

function getActivePlayer() {
  return state.players.find((player) => player.id === state.activePlayerId) || state.players[0];
}

function toggleMusic() {
  state.settings.music = !state.settings.music;
  audio.setMusic(state.settings.music);
  persist();
  syncSettingsUI();
}

function syncSettingsUI() {
  const pressed = String(Boolean(state.settings.music));
  elements.menuMusicToggle.setAttribute("aria-pressed", pressed);
  elements.musicToggle.setAttribute("aria-pressed", pressed);
  elements.volumeSlider.value = String(Math.round(state.settings.volume * 100));
  audio.setMusic(state.settings.music);
  audio.setVolume(state.settings.volume);
}

function persist() {
  saveState(state);
}

function startTimer() {
  stopTimer(false);
  startTime = Date.now() - elapsedBeforePause;
  timerId = window.setInterval(renderGameStats, 500);
}

function stopTimer(remember = true) {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = 0;
  }

  if (remember) {
    elapsedBeforePause = getElapsed();
  }
}

function getElapsed() {
  if (!startTime) {
    return elapsedBeforePause;
  }

  return timerId ? Date.now() - startTime : elapsedBeforePause;
}

function bumpBoard() {
  elements.gameBoard.classList.remove("board-bump");
  window.requestAnimationFrame(() => {
    elements.gameBoard.classList.add("board-bump");
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
