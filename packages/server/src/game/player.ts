// ============================================================
// King of Claws — Player Entity
// ============================================================

import type { Player } from '@king-of-claws/shared';
import {
  PLAYER_INITIAL_HEALTH,
  PLAYER_INITIAL_BOMB_COUNT,
  PLAYER_INITIAL_BOMB_RANGE,
  PLAYER_INITIAL_SPEED,
  PLAYER_COLORS,
  PLAYER_SPAWN_POSITIONS,
} from '@king-of-claws/shared';

/**
 * Create a new player at the given spawn index (0-3).
 */
export function createPlayer(id: string, name: string, spawnIndex: number): Player {
  const spawn = PLAYER_SPAWN_POSITIONS[spawnIndex];
  return {
    id,
    name,
    x: spawn.x,
    y: spawn.y,
    health: PLAYER_INITIAL_HEALTH,
    alive: true,
    bombCount: PLAYER_INITIAL_BOMB_COUNT,
    bombRange: PLAYER_INITIAL_BOMB_RANGE,
    speed: PLAYER_INITIAL_SPEED,
    activeBombs: 0,
    color: PLAYER_COLORS[spawnIndex],
    lastActionTick: -1,
    connected: true,
    armor: 0,
    speedBoostTicks: 0,
    crossBombActive: false,
  };
}

/**
 * Apply damage to a player. Armor absorbs damage first.
 * Returns true if the player was killed.
 */
export function damagePlayer(player: Player, amount: number): boolean {
  if (!player.alive) return false;

  // Armor absorbs damage first
  if (player.armor > 0) {
    player.armor = Math.max(0, player.armor - amount);
    // If armor absorbed all damage, no HP loss
    if (player.armor > 0 || amount <= 0) {
      return false;
    }
    // Armor broke, remaining damage goes to HP
    const remainingDamage = amount - player.armor;
    if (remainingDamage > 0) {
      player.health -= remainingDamage;
    }
  } else {
    // No armor, direct HP damage
    player.health -= amount;
  }

  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
    return true;
  }
  return false;
}
