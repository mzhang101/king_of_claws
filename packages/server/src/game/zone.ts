// ============================================================
// King of Claws — Battle Royale Shrinking Zone
// ============================================================

import type { DangerZone } from '@king-of-claws/shared';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  ZONE_INITIAL_RADIUS,
  ZONE_SHRINK_INTERVAL_TICKS,
  ZONE_DAMAGE_PER_TICK,
} from '@king-of-claws/shared';

/**
 * Create the initial danger zone (full grid is safe).
 */
export function createDangerZone(): DangerZone {
  const r = ZONE_INITIAL_RADIUS;
  const centerX = Math.floor(GRID_WIDTH / 2);
  const centerY = Math.floor(GRID_HEIGHT / 2);

  return {
    currentRadius: r,
    safeMinX: centerX - r,
    safeMaxX: centerX + r,
    safeMinY: centerY - r,
    safeMaxY: centerY + r,
    nextShrinkInTicks: ZONE_SHRINK_INTERVAL_TICKS,
    damagePerTick: ZONE_DAMAGE_PER_TICK,
    phase: 0,
  };
}

/**
 * Update the zone each tick. Returns true if the zone just shrank.
 */
export function updateDangerZone(zone: DangerZone): boolean {
  zone.nextShrinkInTicks--;

  if (zone.nextShrinkInTicks <= 0 && zone.currentRadius > 0) {
    // Shrink the zone
    zone.currentRadius--;
    zone.phase++;

    const centerX = Math.floor(GRID_WIDTH / 2);
    const centerY = Math.floor(GRID_HEIGHT / 2);

    zone.safeMinX = centerX - zone.currentRadius;
    zone.safeMaxX = centerX + zone.currentRadius;
    zone.safeMinY = centerY - zone.currentRadius;
    zone.safeMaxY = centerY + zone.currentRadius;

    // Reset timer for next shrink
    zone.nextShrinkInTicks = ZONE_SHRINK_INTERVAL_TICKS;

    // Increase damage in later phases
    if (zone.phase >= 4) {
      zone.damagePerTick = 2;
    }

    return true;
  }

  return false;
}

/**
 * Check if a position is within the safe zone.
 */
export function isInSafeZone(zone: DangerZone, x: number, y: number): boolean {
  return x >= zone.safeMinX
    && x <= zone.safeMaxX
    && y >= zone.safeMinY
    && y <= zone.safeMaxY;
}
