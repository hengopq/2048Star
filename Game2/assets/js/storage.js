const STORAGE_KEY = "devtools-game2-2048-state-v1";

const playerColors = ["#52d6a4", "#ffd36e", "#6ca0ff", "#ff7c66", "#b98cff", "#35c2c1"];

const defaultState = {
  activePlayerId: "",
  players: [],
  games: [],
  settings: {
    music: true,
    sfx: true,
    volume: 0.38,
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function createPlayer(name, index = 0) {
  const cleanName = sanitizeName(name) || "本地玩家";
  const id = crypto?.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: cleanName,
    color: playerColors[index % playerColors.length],
    createdAt: Date.now(),
    stats: {
      games: 0,
      wins: 0,
      bestScore: 0,
      totalScore: 0,
      maxTile: 2,
      bestTime: 0,
      lastPlayedAt: 0,
    },
  };
}

export function recordGame(state, playerId, summary) {
  const nextState = normalizeState(state);
  const player = nextState.players.find((item) => item.id === playerId);

  if (!player) {
    return nextState;
  }

  const normalizedSummary = {
    id: crypto?.randomUUID ? crypto.randomUUID() : `g-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    playerId,
    playerName: player.name,
    score: Math.max(0, Number(summary.score) || 0),
    maxTile: Math.max(2, Number(summary.maxTile) || 2),
    moves: Math.max(0, Number(summary.moves) || 0),
    duration: Math.max(0, Number(summary.duration) || 0),
    result: summary.result || "结算",
    playedAt: Date.now(),
  };

  player.stats.games += 1;
  player.stats.totalScore += normalizedSummary.score;
  player.stats.bestScore = Math.max(player.stats.bestScore, normalizedSummary.score);
  player.stats.maxTile = Math.max(player.stats.maxTile, normalizedSummary.maxTile);
  player.stats.lastPlayedAt = normalizedSummary.playedAt;

  if (normalizedSummary.result === "胜利") {
    player.stats.wins += 1;

    if (!player.stats.bestTime || normalizedSummary.duration < player.stats.bestTime) {
      player.stats.bestTime = normalizedSummary.duration;
    }
  }

  nextState.games = [normalizedSummary, ...nextState.games].slice(0, 30);
  return nextState;
}

export function getLeaderboard(state, limit = 10) {
  return [...normalizeState(state).players]
    .sort((a, b) => {
      if (b.stats.bestScore !== a.stats.bestScore) {
        return b.stats.bestScore - a.stats.bestScore;
      }

      if (b.stats.maxTile !== a.stats.maxTile) {
        return b.stats.maxTile - a.stats.maxTile;
      }

      return b.stats.wins - a.stats.wins;
    })
    .slice(0, limit);
}

export function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 12);
}

export function formatDuration(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function initials(name) {
  return sanitizeName(name).slice(0, 2).toUpperCase() || "P";
}

function createDefaultState() {
  const player = createPlayer("本地玩家", 0);
  return {
    ...structuredClone(defaultState),
    activePlayerId: player.id,
    players: [player],
  };
}

function normalizeState(state) {
  const normalized = {
    ...structuredClone(defaultState),
    ...state,
    settings: {
      ...defaultState.settings,
      ...(state?.settings || {}),
    },
    players: Array.isArray(state?.players) ? state.players : [],
    games: Array.isArray(state?.games) ? state.games : [],
  };

  normalized.players = normalized.players.map((player, index) => ({
    ...createPlayer(player?.name || `玩家${index + 1}`, index),
    ...player,
    stats: {
      games: 0,
      wins: 0,
      bestScore: 0,
      totalScore: 0,
      maxTile: 2,
      bestTime: 0,
      lastPlayedAt: 0,
      ...(player?.stats || {}),
    },
  }));

  if (!normalized.players.length) {
    const player = createPlayer("本地玩家", 0);
    normalized.players = [player];
    normalized.activePlayerId = player.id;
  }

  if (!normalized.players.some((player) => player.id === normalized.activePlayerId)) {
    normalized.activePlayerId = normalized.players[0].id;
  }

  normalized.settings.volume = Math.min(1, Math.max(0, Number(normalized.settings.volume) || 0));
  normalized.settings.music = Boolean(normalized.settings.music);
  normalized.settings.sfx = Boolean(normalized.settings.sfx);

  return normalized;
}
