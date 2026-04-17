// ============================================================
// King of Claws — Rule-Based Fallback (when Gemini API fails)
// ============================================================
// Extracted from the original botTick() logic.
// Pure function: takes game state snapshot, returns an action.

import type { GameEngine } from '../game/engine.js';
import type { PlayerAction } from '@king-of-claws/shared';

/**
 * Rule-based decision: flee danger → place bomb (25%) → random walk.
 * Returns null if no action is possible (dead, or no moves available).
 */
export function ruleFallbackDecision(
  botId: string,
  engine: GameEngine,
): PlayerAction | null {
  if (engine.getStatus() !== 'playing') return null;

  const player = engine.getPlayer(botId);
  if (!player || !player.alive) return null;

  const state = engine.getState();
  const dirs = ['up', 'down', 'left', 'right'] as const;
  const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

  // Available moves
  const available = dirs.filter(d => {
    const [dx, dy] = offsets[d];
    return engine.canMoveToPosition(player.x + dx, player.y + dy);
  });

  // Check if in danger (bomb nearby in same row/col)
  const nearbyBombs = state.bombs.filter(b =>
    (b.x === player.x && Math.abs(b.y - player.y) <= b.range) ||
    (b.y === player.y && Math.abs(b.x - player.x) <= b.range)
  );
  const inDanger = nearbyBombs.length > 0 || !engine.isPositionSafe(player.x, player.y);

  if (inDanger && available.length > 0) {
    // Flee: move away from threats
    const safeDir = available.find(d => {
      const [dx, dy] = offsets[d];
      const nx = player.x + dx;
      const ny = player.y + dy;
      return !nearbyBombs.some(b =>
        (b.x === nx && Math.abs(b.y - ny) <= b.range) ||
        (b.y === ny && Math.abs(b.x - nx) <= b.range)
      ) && engine.isPositionSafe(nx, ny);
    }) ?? available[Math.floor(Math.random() * available.length)];
    return { type: 'move', direction: safeDir };
  }

  if (Math.random() < 0.25 && player.activeBombs < player.bombCount) {
    return { type: 'place_bomb' };
  }

  if (available.length > 0) {
    const dir = available[Math.floor(Math.random() * available.length)];
    return { type: 'move', direction: dir };
  }

  return null;
}
