// ============================================================
// King of Claws — Power-up System
// ============================================================

import type { Player, PowerUp } from '@king-of-claws/shared';
import { PowerUpType } from '@king-of-claws/shared';

/**
 * Apply a power-up effect to a player.
 */
export function applyPowerUp(player: Player, powerup: PowerUp): void {
  switch (powerup.type) {
    case PowerUpType.BOMB_COUNT:
      player.bombCount += 1;
      break;
    case PowerUpType.BOMB_RANGE:
      player.bombRange += 1;
      break;
    case PowerUpType.SPEED:
      player.speed = Math.min(player.speed + 1, 2); // cap at 2
      break;
    case PowerUpType.ARMOR:
      player.armor = Math.max(player.armor, 1); // Basic armor (1 hit)
      break;
    case PowerUpType.HEAVY_ARMOR:
      player.armor = 2; // Heavy armor (2 hits)
      break;
    case PowerUpType.HEALTH_PATCH:
      player.health = Math.min(player.health + 1, 3); // cap at 3 (initial max)
      break;
    case PowerUpType.SPEED_BOOST:
      player.speedBoostTicks = 10; // 10 ticks = 2 seconds
      break;
    case PowerUpType.SHAPE_FLOPPY:
      player.crossBombActive = true; // Next bomb will be cross-shaped
      break;
  }
}

/**
 * Reveal a hidden power-up at a destroyed brick position.
 * Returns the power-up if found, otherwise null.
 */
export function revealPowerUp(
  powerups: PowerUp[],
  x: number,
  y: number,
): PowerUp | null {
  const hidden = powerups.find(p => p.x === x && p.y === y && !p.visible);
  if (hidden) {
    hidden.visible = true;
    return hidden;
  }
  return null;
}
