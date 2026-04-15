// ============================================================
// King of Claws — Bomb System
// ============================================================

import type { Bomb, Explosion, Position, TileType as TileTypeEnum } from '@king-of-claws/shared';
import { TileType, BOMB_TIMER_TICKS, EXPLOSION_DURATION_TICKS } from '@king-of-claws/shared';
import { isInBounds } from './grid.js';
import { v4 as uuid } from 'uuid';

/**
 * Create a new bomb at the given position.
 */
export function createBomb(
  ownerId: string,
  x: number,
  y: number,
  range: number,
  shape: 'point' | 'cross' = 'point'
): Bomb {
  return {
    id: uuid(),
    ownerId,
    x,
    y,
    range,
    ticksRemaining: BOMB_TIMER_TICKS,
    shape,
  };
}

/**
 * Calculate explosion tiles for a detonating bomb.
 * - 'point' shape: only the center tile
 * - 'cross' shape: propagates in 4 cardinal directions up to `range` tiles
 * Stops at walls (does not destroy them).
 * Stops at bricks (destroys them, but does not pass through).
 * Returns the set of affected tile positions and destroyed brick positions.
 */
export function calculateExplosion(
  bomb: Bomb,
  grid: TileTypeEnum[][],
  bombs: Bomb[],
): {
  affectedTiles: Position[];
  destroyedBricks: Position[];
  chainBombIds: string[];
} {
  const affectedTiles: Position[] = [];
  const destroyedBricks: Position[] = [];
  const chainBombIds: string[] = [];

  // Center tile always affected
  affectedTiles.push({ x: bomb.x, y: bomb.y });

  // Check for chain reaction at center
  const centerChain = bombs.find(b => b.x === bomb.x && b.y === bomb.y && b.id !== bomb.id);
  if (centerChain) {
    chainBombIds.push(centerChain.id);
  }

  // If point shape, only center explodes
  if (bomb.shape === 'point') {
    return { affectedTiles, destroyedBricks, chainBombIds };
  }

  // Cross shape: propagate in 4 directions
  const directions: Position[] = [
    { x: 0, y: -1 }, // up
    { x: 0, y: 1 },  // down
    { x: -1, y: 0 }, // left
    { x: 1, y: 0 },  // right
  ];

  for (const dir of directions) {
    for (let i = 1; i <= bomb.range; i++) {
      const nx = bomb.x + dir.x * i;
      const ny = bomb.y + dir.y * i;

      if (!isInBounds(nx, ny)) break;

      const tile = grid[ny][nx];

      if (tile === TileType.WALL) {
        // Hit indestructible wall — stop propagation
        break;
      }

      // This tile is affected by the explosion
      affectedTiles.push({ x: nx, y: ny });

      if (tile === TileType.BRICK) {
        // Destroy brick and stop propagation in this direction
        destroyedBricks.push({ x: nx, y: ny });
        break;
      }

      // Check if another bomb is at this position → chain detonation
      const chainBomb = bombs.find(b => b.x === nx && b.y === ny && b.id !== bomb.id);
      if (chainBomb) {
        chainBombIds.push(chainBomb.id);
      }
    }
  }

  return { affectedTiles, destroyedBricks, chainBombIds };
}

/**
 * Create an Explosion visual effect from affected tiles.
 */
export function createExplosion(tiles: Position[]): Explosion {
  return {
    id: uuid(),
    tiles,
    ticksRemaining: EXPLOSION_DURATION_TICKS,
  };
}
