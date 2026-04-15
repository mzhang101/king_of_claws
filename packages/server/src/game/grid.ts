// ============================================================
// King of Claws — Grid / Map Generation
// ============================================================

import {
  TileType,
  PowerUpType,
  type PowerUp,
  type Position,
} from '@king-of-claws/shared';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  PLAYER_SPAWN_POSITIONS,
  POWERUP_SPAWN_CHANCE,
} from '@king-of-claws/shared';
import { v4 as uuid } from 'uuid';

/**
 * Generate a standard Bomberman grid:
 *  - Indestructible walls in a checkerboard pattern (even row & even col)
 *  - Destructible bricks fill the rest
 *  - Spawn corners cleared (3-tile L-shape for each player)
 *  - Random gaps in bricks for pathways
 */
export function generateGrid(): {
  grid: TileType[][];
  hiddenPowerups: PowerUp[];
} {
  const grid: TileType[][] = [];
  const hiddenPowerups: PowerUp[] = [];

  // 1. Fill with bricks
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      grid[y][x] = TileType.BRICK;
    }
  }

  // 2. Place indestructible walls in checkerboard pattern (even row, even col)
  // Only inner positions — leave edges flexible
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (y % 2 === 1 && x % 2 === 1) {
        grid[y][x] = TileType.WALL;
      }
    }
  }

  // 3. Clear spawn corners — each player gets a 3-tile L-shape
  for (const spawn of PLAYER_SPAWN_POSITIONS) {
    clearSpawnArea(grid, spawn.x, spawn.y);
  }

  // 4. Randomly remove ~25% of remaining bricks to create paths
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid[y][x] === TileType.BRICK && Math.random() < 0.25) {
        grid[y][x] = TileType.EMPTY;
      }
    }
  }

  // 5. Place hidden power-ups under remaining bricks
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid[y][x] === TileType.BRICK && Math.random() < POWERUP_SPAWN_CHANCE) {
        const types = [PowerUpType.BOMB_COUNT, PowerUpType.BOMB_RANGE, PowerUpType.SPEED];
        hiddenPowerups.push({
          id: uuid(),
          x,
          y,
          type: types[Math.floor(Math.random() * types.length)],
          visible: false,
        });
      }
    }
  }

  return { grid, hiddenPowerups };
}

/**
 * Clear a 3-tile L-shape area at a corner for player spawning.
 * Ensures the player has room to move at start.
 */
function clearSpawnArea(grid: TileType[][], sx: number, sy: number): void {
  // The spawn tile itself
  grid[sy][sx] = TileType.EMPTY;

  // Adjacent tiles (L-shape from corner)
  const dx = sx === 0 ? 1 : -1;
  const dy = sy === 0 ? 1 : -1;

  // Horizontal neighbor
  if (isInBounds(sx + dx, sy)) {
    grid[sy][sx + dx] = TileType.EMPTY;
  }
  // Vertical neighbor
  if (isInBounds(sx, sy + dy)) {
    grid[sy + dy][sx] = TileType.EMPTY;
  }
}

/** Check if position is within grid bounds */
export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
}

/** Check if a tile is walkable (empty) */
export function isWalkable(grid: TileType[][], x: number, y: number): boolean {
  if (!isInBounds(x, y)) return false;
  return grid[y][x] === TileType.EMPTY;
}
