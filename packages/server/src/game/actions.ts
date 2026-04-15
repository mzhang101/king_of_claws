// ============================================================
// King of Claws — Action Validation & Execution
// ============================================================

import type { Player, PlayerAction, ActionResult, Bomb, TileType as TileTypeEnum } from '@king-of-claws/shared';
import { TileType, type Direction } from '@king-of-claws/shared';
import { isInBounds } from './grid.js';

/**
 * Direction offsets mapping.
 */
const DIRECTION_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1,  dy: 0 },
};

/**
 * Validate and describe the result of a move action.
 */
export function validateMove(
  player: Player,
  direction: Direction,
  grid: TileTypeEnum[][],
  bombs: Bomb[],
): ActionResult {
  if (!player.alive) {
    return { accepted: false, message: 'You are eliminated and cannot move.' };
  }

  const offset = DIRECTION_OFFSETS[direction];
  const newX = player.x + offset.dx;
  const newY = player.y + offset.dy;

  if (!isInBounds(newX, newY)) {
    return { accepted: false, message: `Cannot move ${direction}: out of bounds.` };
  }

  const tile = grid[newY][newX];
  if (tile === TileType.WALL || tile === TileType.BRICK) {
    return { accepted: false, message: `Cannot move ${direction}: blocked by ${tile === TileType.WALL ? 'wall' : 'brick'}.` };
  }

  // Check for bombs blocking the path
  const bombBlocking = bombs.some(b => b.x === newX && b.y === newY);
  if (bombBlocking) {
    return { accepted: false, message: `Cannot move ${direction}: blocked by a bomb.` };
  }

  return {
    accepted: true,
    message: `Move ${direction} queued.`,
    projectedPosition: { x: newX, y: newY },
  };
}

/**
 * Validate a place_bomb action.
 */
export function validatePlaceBomb(
  player: Player,
  bombs: Bomb[],
): ActionResult {
  if (!player.alive) {
    return { accepted: false, message: 'You are eliminated and cannot place bombs.' };
  }

  if (player.activeBombs >= player.bombCount) {
    return { accepted: false, message: `Cannot place bomb: max active bombs reached (${player.bombCount}).` };
  }

  // Check if there's already a bomb at this position
  const existingBomb = bombs.some(b => b.x === player.x && b.y === player.y);
  if (existingBomb) {
    return { accepted: false, message: 'Cannot place bomb: a bomb is already at your position.' };
  }

  return {
    accepted: true,
    message: `Bomb placed at (${player.x}, ${player.y}).`,
    bombX: player.x,
    bombY: player.y,
    range: player.bombRange,
  };
}

/**
 * Check if a position can be moved to (for get_my_status helper).
 */
export function canMoveTo(
  x: number,
  y: number,
  grid: TileTypeEnum[][],
  bombs: Bomb[],
): boolean {
  if (!isInBounds(x, y)) return false;
  if (grid[y][x] !== TileType.EMPTY) return false;
  if (bombs.some(b => b.x === x && b.y === y)) return false;
  return true;
}
