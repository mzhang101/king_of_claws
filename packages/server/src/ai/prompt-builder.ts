// ============================================================
// King of Claws — Tactical Prompt Builder
// ============================================================
// Builds a compact prompt (~300-500 tokens) from game state
// for Gemini Flash to decide the next action.

import type { GameEngine } from '../game/engine.js';
import type { StrategyState } from './strategy-store.js';
import { TileType } from '@king-of-claws/shared';

/**
 * Build a compact prompt for the tactical AI model.
 * Encodes the game grid as ASCII and includes all relevant context.
 */
export function buildTacticalPrompt(
  engine: GameEngine,
  playerId: string,
  strategy: StrategyState,
): string | null {
  const player = engine.getPlayer(playerId);
  if (!player || !player.alive) return null;

  const state = engine.getState();

  // Build ASCII grid (13 lines)
  const gridChars: string[][] = state.grid.map(row =>
    row.map(tile => {
      if (tile === TileType.WALL) return '#';
      if (tile === TileType.BRICK) return 'B';
      return '.';
    })
  );

  // Mark bombs
  for (const bomb of state.bombs) {
    if (bomb.y >= 0 && bomb.y < gridChars.length && bomb.x >= 0 && bomb.x < gridChars[0].length) {
      gridChars[bomb.y][bomb.x] = '*';
    }
  }

  // Mark explosions
  for (const exp of state.explosions) {
    for (const tile of exp.tiles) {
      if (tile.y >= 0 && tile.y < gridChars.length && tile.x >= 0 && tile.x < gridChars[0].length) {
        gridChars[tile.y][tile.x] = '!';
      }
    }
  }

  // Mark power-ups (visible only)
  for (const pu of state.powerups) {
    if (pu.visible && pu.y >= 0 && pu.y < gridChars.length && pu.x >= 0 && pu.x < gridChars[0].length) {
      gridChars[pu.y][pu.x] = 'P';
    }
  }

  // Mark other players
  for (const p of state.players) {
    if (p.alive && p.id !== playerId && p.y >= 0 && p.y < gridChars.length && p.x >= 0 && p.x < gridChars[0].length) {
      gridChars[p.y][p.x] = 'E';
    }
  }

  // Mark self
  if (player.y >= 0 && player.y < gridChars.length && player.x >= 0 && player.x < gridChars[0].length) {
    gridChars[player.y][player.x] = '@';
  }

  const gridStr = gridChars.map((row, i) =>
    `${String(i).padStart(2, ' ')} ${row.join('')}`
  ).join('\n');

  // Nearby bombs details
  const dangerBombs = state.bombs
    .filter(b => Math.abs(b.x - player.x) + Math.abs(b.y - player.y) <= 4)
    .map(b => `(${b.x},${b.y}) fuse:${b.ticksRemaining} range:${b.range}${b.ownerId === playerId ? ' MINE' : ''}`)
    .join('; ');

  // Nearby players
  const nearPlayers = state.players
    .filter(p => p.id !== playerId && p.alive && Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 6)
    .map(p => `${p.name}(${p.x},${p.y}) hp:${p.health}`)
    .join('; ');

  // Available moves
  const moves: string[] = [];
  if (engine.canMoveToPosition(player.x, player.y - 1)) moves.push('up');
  if (engine.canMoveToPosition(player.x, player.y + 1)) moves.push('down');
  if (engine.canMoveToPosition(player.x - 1, player.y)) moves.push('left');
  if (engine.canMoveToPosition(player.x + 1, player.y)) moves.push('right');

  const canBomb = player.activeBombs < player.bombCount;
  const inDanger = !engine.isPositionSafe(player.x, player.y);

  // Strategy directive
  let strategyLine = `Strategy: ${strategy.mode}`;
  if (strategy.targetPlayerId) {
    const target = state.players.find(p => p.id === strategy.targetPlayerId);
    if (target && target.alive) {
      strategyLine += ` | Target: ${target.name}(${target.x},${target.y})`;
    }
  }
  if (strategy.priorities.length > 0) {
    strategyLine += ` | Priorities: ${strategy.priorities.join(',')}`;
  }
  if (strategy.customDirective) {
    strategyLine += ` | Directive: ${strategy.customDirective}`;
  }

  return `You are @ in a Bomberman game on a 13x13 grid. Pick the best action.
Legend: .=empty #=wall B=brick *=bomb !=explosion P=powerup E=enemy @=you

${gridStr}

You: (${player.x},${player.y}) hp:${player.health}/${5} bombs:${player.activeBombs}/${player.bombCount} range:${player.bombRange}
Tick: ${state.tick} | InDanger: ${inDanger} | CanBomb: ${canBomb}
Moves: [${moves.join(',')}]${dangerBombs ? `\nBombs: ${dangerBombs}` : ''}${nearPlayers ? `\nEnemies: ${nearPlayers}` : ''}
${strategyLine}

Rules:
- If in danger (on bomb blast path), FLEE immediately to a safe tile
- Bombs explode in + shape after 5 ticks, range tiles each direction
- Destroy bricks to find powerups, but always have an escape route
- Don't stand on your own bomb's blast path

Respond with ONLY valid JSON, no other text:
{"action":"move","direction":"up|down|left|right","reasoning":"brief reason"}
or {"action":"bomb","reasoning":"brief reason"}
or {"action":"wait","reasoning":"brief reason"}`;
}
