// ============================================================
// King of Claws — Airdrop System
// ============================================================

import { randomUUID } from 'crypto';
import type { Airdrop, PowerUpType, Player } from '@king-of-claws/shared';

const AIRDROP_DELAY_TICKS = 3;
const AIRDROP_COOLDOWN_TICKS = 150; // 30 seconds at 5 ticks/sec

// Premium power-ups for airdrops
const AIRDROP_POWERUPS: PowerUpType[] = [
  'heavy_armor',
  'bomb_range',
  'bomb_count',
  'speed',
  'shape_floppy',
  'health_patch',
];

// Create a new airdrop
export function createAirdrop(
  playerId: string,
  agent: Player
): Airdrop {
  const powerUpType = AIRDROP_POWERUPS[Math.floor(Math.random() * AIRDROP_POWERUPS.length)];

  return {
    id: randomUUID(),
    playerId,
    targetX: agent.x,
    targetY: agent.y,
    ticksRemaining: AIRDROP_DELAY_TICKS,
    powerUpType,
  };
}

// Check if airdrop is on cooldown
export function isAirdropOnCooldown(lastAirdropTick: number, currentTick: number): boolean {
  return currentTick - lastAirdropTick < AIRDROP_COOLDOWN_TICKS;
}

// Get cooldown remaining in seconds
export function getAirdropCooldownSeconds(lastAirdropTick: number, currentTick: number): number {
  const ticksRemaining = AIRDROP_COOLDOWN_TICKS - (currentTick - lastAirdropTick);
  return Math.max(0, Math.ceil(ticksRemaining / 5));
}
