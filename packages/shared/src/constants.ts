// ============================================================
// King of Claws — Game Constants
// ============================================================

// -- Grid --
export const GRID_WIDTH = 13;
export const GRID_HEIGHT = 13;

// -- Tick --
export const TICK_RATE = 5; // ticks per second
export const TICK_INTERVAL_MS = 1000 / TICK_RATE; // 200ms

// -- Players --
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS_TO_START = 2;
export const PLAYER_INITIAL_HEALTH = 5;
export const PLAYER_INITIAL_BOMB_COUNT = 1;
export const PLAYER_INITIAL_BOMB_RANGE = 2;
export const PLAYER_INITIAL_SPEED = 1;

// -- Bombs --
export const BOMB_TIMER_TICKS = 15; // 3 seconds
export const EXPLOSION_DURATION_TICKS = 3; // 0.6 seconds

// -- Battle Royale Zone --
export const ZONE_INITIAL_RADIUS = 6; // full grid safe
export const ZONE_SHRINK_INTERVAL_TICKS = 150; // 30 seconds
export const ZONE_DAMAGE_PER_TICK = 1;

// -- Timing --
export const COUNTDOWN_SECONDS = 5;
export const MAX_MATCH_DURATION_TICKS = 1200; // 4 minutes
export const AFK_TIMEOUT_TICKS = 150; // 30 seconds

// -- Power-ups --
export const POWERUP_SPAWN_CHANCE = 0.3;

// -- Server --
// Support environment variable override for cloud deployment
export const SERVER_PORT = typeof process !== 'undefined' && process.env?.PORT
  ? Number(process.env.PORT)
  : 3001;
export const CLIENT_PORT = 5173;

// Public URL for MCP endpoints (set to your cloud server's public address)
// e.g. "https://your-server.com" or "http://1.2.3.4:3001"
export const PUBLIC_URL = typeof process !== 'undefined' && process.env?.PUBLIC_URL
  ? process.env.PUBLIC_URL
  : `http://localhost:${SERVER_PORT}`;

// -- Visual --
export const TILE_SIZE = 48; // pixels per grid tile
export const CANVAS_WIDTH = GRID_WIDTH * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_HEIGHT * TILE_SIZE;

export const PLAYER_COLORS = ['#FF4444', '#44AAFF', '#44FF44', '#FFAA44'] as const;

export const PLAYER_SPAWN_POSITIONS = [
  { x: 0, y: 0 },   // top-left
  { x: 12, y: 12 }, // bottom-right
  { x: 12, y: 0 },  // top-right
  { x: 0, y: 12 },  // bottom-left
] as const;
