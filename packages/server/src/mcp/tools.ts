// ============================================================
// King of Claws — MCP Tool Definitions
// ============================================================

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GameEngine } from '../game/engine.js';

/**
 * Register all game MCP tools on a McpServer instance for a specific player.
 * Each tool handler closes over the playerId so calls are player-scoped.
 */
export function registerGameTools(
  server: McpServer,
  playerId: string,
  getEngine: () => GameEngine,
): void {

  // ---- Tool 1: get_game_state ----
  server.tool(
    'get_game_state',
    'Get the current game state including the map grid, all player positions and health, active bombs with countdown timers, visible power-ups, danger zone boundaries, and current tick number. Call this frequently to stay aware of the battlefield. The grid is a 13x13 array where 0=EMPTY, 1=WALL(indestructible), 2=BRICK(destructible).',
    {},
    async () => {
      const engine = getEngine();
      const state = engine.getState();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            tick: state.tick,
            status: state.status,
            grid: state.grid,
            gridLegend: {
              0: 'EMPTY - walkable',
              1: 'WALL - indestructible, blocks movement and explosions',
              2: 'BRICK - destructible by bombs, blocks movement',
            },
            players: state.players.map(p => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              alive: p.alive,
              health: p.health,
              isYou: p.id === playerId,
            })),
            bombs: state.bombs.map(b => ({
              x: b.x,
              y: b.y,
              ticksRemaining: b.ticksRemaining,
              range: b.range,
              ownerId: b.ownerId,
              isYours: b.ownerId === playerId,
            })),
            explosions: state.explosions.flatMap(e =>
              e.tiles.map(t => ({ x: t.x, y: t.y }))
            ),
            powerups: state.powerups.map(p => ({
              x: p.x,
              y: p.y,
              type: p.type,
            })),
            dangerZone: {
              safeArea: {
                minX: state.dangerZone.safeMinX,
                maxX: state.dangerZone.safeMaxX,
                minY: state.dangerZone.safeMinY,
                maxY: state.dangerZone.safeMaxY,
              },
              nextShrinkInTicks: state.dangerZone.nextShrinkInTicks,
              damagePerTick: state.dangerZone.damagePerTick,
              phase: state.dangerZone.phase,
            },
            winner: state.winner,
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool 2: move ----
  server.tool(
    'move',
    'Move your character one tile in the specified direction. Cannot move into walls, bricks, bombs, or out of bounds. Coordinates: up=y-1, down=y+1, left=x-1, right=x+1. You can submit one action per game tick (200ms). Moving quickly and frequently gives you a strategic advantage.',
    {
      direction: z.enum(['up', 'down', 'left', 'right'])
        .describe('Direction to move: up (y-1), down (y+1), left (x-1), right (x+1)'),
    },
    async ({ direction }) => {
      const engine = getEngine();
      const result = engine.queueAction(playerId, {
        type: 'move',
        direction,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: result.accepted,
            message: result.message,
            newPosition: result.accepted ? result.projectedPosition : undefined,
          }),
        }],
      };
    },
  );

  // ---- Tool 3: place_bomb ----
  server.tool(
    'place_bomb',
    'Place a bomb at your current position. The bomb explodes after 3 seconds (15 ticks), sending explosions in 4 cardinal directions up to your bomb_range. Explosions destroy bricks, damage players (1 HP), and chain-detonate other bombs. You can have at most bomb_count active bombs simultaneously.',
    {},
    async () => {
      const engine = getEngine();
      const result = engine.queueAction(playerId, {
        type: 'place_bomb',
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: result.accepted,
            message: result.message,
            bombInfo: result.accepted ? {
              x: result.bombX,
              y: result.bombY,
              range: result.range,
              detonatesInTicks: 15,
              detonatesInSeconds: 3,
            } : undefined,
          }),
        }],
      };
    },
  );

  // ---- Tool 4: get_my_status ----
  server.tool(
    'get_my_status',
    'Get your detailed player status including position, health, power-up levels, active bomb count, danger zone status, nearby threats, and available moves. The availableMoves field tells you which directions you can move right now. Use this for quick tactical decisions.',
    {},
    async () => {
      const engine = getEngine();
      const player = engine.getPlayer(playerId);

      if (!player) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Player not found' }),
          }],
        };
      }

      const state = engine.getState();
      const inDanger = !engine.isPositionSafe(player.x, player.y);

      // Find nearby bombs (within 4 tiles manhattan distance)
      const nearbyBombs = state.bombs.filter(b =>
        Math.abs(b.x - player.x) + Math.abs(b.y - player.y) <= 4
      );

      // Find nearby players
      const nearbyPlayers = state.players.filter(p =>
        p.id !== playerId && p.alive &&
        Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 5
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            id: player.id,
            name: player.name,
            position: { x: player.x, y: player.y },
            health: player.health,
            maxHealth: 3,
            alive: player.alive,
            stats: {
              bombCount: player.bombCount,
              bombRange: player.bombRange,
              speed: player.speed,
              activeBombs: player.activeBombs,
            },
            inDangerZone: inDanger,
            nearbyBombs: nearbyBombs.map(b => ({
              x: b.x,
              y: b.y,
              ticksRemaining: b.ticksRemaining,
              range: b.range,
              isOwn: b.ownerId === playerId,
              dangerDirections: getBombDangerDirections(b, player),
            })),
            nearbyPlayers: nearbyPlayers.map(p => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              health: p.health,
            })),
            availableMoves: {
              up: engine.canMoveToPosition(player.x, player.y - 1),
              down: engine.canMoveToPosition(player.x, player.y + 1),
              left: engine.canMoveToPosition(player.x - 1, player.y),
              right: engine.canMoveToPosition(player.x + 1, player.y),
            },
            canPlaceBomb: player.activeBombs < player.bombCount,
            gameStatus: state.status,
            currentTick: state.tick,
          }, null, 2),
        }],
      };
    },
  );
}

/**
 * Helper: determine which directions a bomb threatens relative to a player.
 */
function getBombDangerDirections(
  bomb: { x: number; y: number; range: number },
  player: { x: number; y: number },
): string[] {
  const dirs: string[] = [];
  if (bomb.x === player.x) {
    if (bomb.y > player.y && bomb.y - player.y <= bomb.range) dirs.push('below you');
    if (bomb.y < player.y && player.y - bomb.y <= bomb.range) dirs.push('above you');
  }
  if (bomb.y === player.y) {
    if (bomb.x > player.x && bomb.x - player.x <= bomb.range) dirs.push('to your right');
    if (bomb.x < player.x && player.x - bomb.x <= bomb.range) dirs.push('to your left');
  }
  if (bomb.x === player.x && bomb.y === player.y) dirs.push('at your position!');
  return dirs;
}
