// ============================================================
// King of Claws — Game Types
// ============================================================

// -- Tiles --
export enum TileType {
  EMPTY = 0,
  WALL = 1,       // indestructible
  BRICK = 2,      // destructible
}

// -- Power-up Types --
export enum PowerUpType {
  BOMB_COUNT = 'bomb_count',
  BOMB_RANGE = 'bomb_range',
  SPEED = 'speed',
  ARMOR = 'armor',              // Basic armor: blocks 1 hit
  HEAVY_ARMOR = 'heavy_armor',  // Heavy armor: blocks 2 hits
  HEALTH_PATCH = 'health_patch', // Restore 1 HP
  SPEED_BOOST = 'speed_boost',   // Temporary speed boost (10 ticks)
  SHAPE_FLOPPY = 'shape_floppy', // Change bomb explosion shape to cross
}

// -- Directions --
export type Direction = 'up' | 'down' | 'left' | 'right';

// -- Position --
export interface Position {
  x: number;
  y: number;
}

// -- Player --
export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  alive: boolean;
  bombCount: number;    // max simultaneous bombs
  bombRange: number;    // explosion radius in tiles
  speed: number;        // moves per tick
  activeBombs: number;  // currently placed bombs count
  color: string;
  lastActionTick: number;
  connected: boolean;
  // New armor system
  armor: number;        // 0 = no armor, 1 = basic, 2 = heavy
  // Temporary effects
  speedBoostTicks: number;  // remaining ticks of speed boost
  crossBombActive: boolean; // next bomb will be cross-shaped
}

// -- Bomb --
export interface Bomb {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  range: number;
  ticksRemaining: number;
  shape: 'point' | 'cross'; // Explosion shape: point (default) or cross
}

// -- Explosion --
export interface Explosion {
  id: string;
  tiles: Position[];
  ticksRemaining: number;
}

// -- Power-up --
export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  visible: boolean; // false = hidden under brick
}

// -- Danger Zone --
export interface DangerZone {
  currentRadius: number;
  safeMinX: number;
  safeMaxX: number;
  safeMinY: number;
  safeMaxY: number;
  nextShrinkInTicks: number;
  damagePerTick: number;
  phase: number;
}

// -- Player Action --
export type PlayerAction =
  | { type: 'move'; direction: Direction; thought?: string; shout?: string }
  | { type: 'place_bomb'; thought?: string; shout?: string };

// -- Action Result --
export interface ActionResult {
  accepted: boolean;
  message: string;
  projectedPosition?: Position;
  bombX?: number;
  bombY?: number;
  range?: number;
}

// -- Agent Action Log (for spectator display) --
export interface AgentActionLog {
  playerId: string;
  playerName: string;
  tick: number;
  action: string;
  thought?: string;
  shout?: string;
  timestamp: number;
  // AI tactical brain fields
  aiReasoning?: string;
  strategyMode?: string;
  wasFallback?: boolean;
}

// -- Game Status --
export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

// -- Full Game State --
export interface GameState {
  roomId: string;
  status: GameStatus;
  tick: number;
  grid: TileType[][];
  players: Player[];
  bombs: Bomb[];
  explosions: Explosion[];
  powerups: PowerUp[];
  dangerZone: DangerZone;
  winner: string | null;
  countdownRemaining: number | null;
  recentActions: AgentActionLog[]; // Last 10 agent actions with thoughts
  airdrops: Airdrop[]; // Active airdrops
}

// -- Room Summary (for lobby) --
export interface RoomSummary {
  id: string;
  name: string;
  status: GameStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
}

// -- Match Stats --
export interface MatchStats {
  duration: number;
  totalBombsPlaced: number;
  bricksDestroyed: number;
  playerStats: Array<{
    id: string;
    name: string;
    survived: boolean;
    bombsPlaced: number;
    powerupsCollected: number;
    damageDealt: number;
    damageTaken: number;
  }>;
}

// -- Player Account --
export interface PlayerAccount {
  id: string;              // Player unique ID
  token: string;           // Access token for player page
  credits: number;         // Credit balance
  agentId: string;         // Associated agent ID
  roomId: string;          // Current room ID
  createdAt: number;       // Timestamp
  lastLogin: number;       // Last login timestamp
  lastAirdropTick: number; // Last airdrop tick (for cooldown)
}

// -- Airdrop --
export interface Airdrop {
  id: string;
  playerId: string;        // Player who called the airdrop
  targetX: number;         // Target grid position
  targetY: number;
  ticksRemaining: number;  // Countdown to landing (3 ticks)
  powerUpType: PowerUpType; // What will drop
}
