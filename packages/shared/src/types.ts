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
}

// -- Bomb --
export interface Bomb {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  range: number;
  ticksRemaining: number;
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
  | { type: 'move'; direction: Direction }
  | { type: 'place_bomb' };

// -- Action Result --
export interface ActionResult {
  accepted: boolean;
  message: string;
  projectedPosition?: Position;
  bombX?: number;
  bombY?: number;
  range?: number;
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
