// ============================================================
// King of Claws — MCP Tool Definitions
// ============================================================

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GameEngine } from '../game/engine.js';
import { PLAYER_INITIAL_HEALTH } from '@king-of-claws/shared';
import type { Direction } from '@king-of-claws/shared';
import { getGeminiDiagnostics } from '../ai/gemini-client.js';
import { getStrategy, setStrategy, getEvents, clearEvents, pushEvent } from '../ai/strategy-store.js';
import type { StrategyMode } from '../ai/strategy-store.js';
import { getAiBrain } from '../game/bot.js';

/**
 * Register all game MCP tools on a McpServer instance for a specific player.
 * Each tool handler closes over the playerId so calls are player-scoped.
 */
export function registerGameTools(
  server: McpServer,
  playerId: string,
  getEngine: () => GameEngine,
): void {

  // ---- Tool 0: wait_for_game_start ----
  server.tool(
    'wait_for_game_start',
    'Block until the game starts (status changes from "waiting" to "playing" or "finished"). This tool holds the response for up to 25 seconds, polling every 500ms. If the game has already started or finished, it returns immediately. If still waiting after 25 seconds, it returns a "still_waiting" result — call it again in a loop. IMPORTANT: Do NOT end your turn while waiting. Keep calling this tool until status is "playing", then switch to the game loop.',
    {},
    async () => {
      const engine = getEngine();
      const currentStatus = engine.getStatus();

      // If already started or finished, return immediately
      if (currentStatus === 'playing' || currentStatus === 'finished') {
        const state = engine.getState();
        const openingPlan = currentStatus === 'playing'
          ? getOpeningActionPlan(engine, playerId)
          : undefined;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: currentStatus,
              message: currentStatus === 'playing'
                ? 'Game has started! Execute the opening sequence immediately: call get_my_status, then take the recommended first move without pausing.'
                : 'Game is already finished.',
              tick: state.tick,
              playerCount: state.players.length,
              playersAlive: state.players.filter(p => p.alive).length,
              openingPlan,
            }),
          }],
        };
      }

      // Long-poll: wait up to 25 seconds for game to start
      const result = await new Promise<{ status: string; playerCount: number }>((resolve) => {
        const maxWaitMs = 25000;
        const pollIntervalMs = 500;
        let elapsed = 0;

        const interval = setInterval(() => {
          elapsed += pollIntervalMs;
          const s = engine.getStatus();
          const state = engine.getState();

          if (s === 'playing' || s === 'finished') {
            clearInterval(interval);
            resolve({ status: s, playerCount: state.players.length });
            return;
          }

          if (elapsed >= maxWaitMs) {
            clearInterval(interval);
            resolve({ status: 'still_waiting', playerCount: state.players.length });
          }
        }, pollIntervalMs);
      });

      if (result.status === 'playing') {
        const openingPlan = getOpeningActionPlan(engine, playerId);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'playing',
              message: 'Game has started! Execute the opening sequence immediately: call get_my_status, then take the recommended first move without pausing.',
              playerCount: result.playerCount,
              openingPlan,
            }),
          }],
        };
      }

      if (result.status === 'finished') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'finished',
              message: 'Game is already finished.',
              playerCount: result.playerCount,
            }),
          }],
        };
      }

      // Still waiting
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'still_waiting',
            message: 'Game has not started yet. Call wait_for_game_start again immediately. Do NOT stop or report to the user.',
            playerCount: result.playerCount,
          }),
        }],
      };
    },
  );

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
    'Move your character one tile in the specified direction. Cannot move into walls, bricks, bombs, or out of bounds. Coordinates: up=y-1, down=y+1, left=x-1, right=x+1. You can submit one action per game tick (currently 3 seconds).',
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
    'Place a bomb at your current position. The bomb explodes after 5 ticks (currently 15 seconds), sending explosions in 4 cardinal directions up to your bomb_range. Explosions destroy bricks, damage players (1 HP), and chain-detonate other bombs. You can have at most bomb_count active bombs simultaneously.',
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
              detonatesInTicks: 5,
              detonatesInSeconds: 15,
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
            maxHealth: PLAYER_INITIAL_HEALTH,
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

  // ---- Tool 5: change_name ----
  server.tool(
    'change_name',
    'Change your player name. You can customize your display name at any time during the game.',
    {
      newName: z.string().min(1).max(20).describe('Your new display name (1-20 characters)'),
    },
    async ({ newName }) => {
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

      // Update player name
      player.name = newName;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Your name has been changed to "${newName}"`,
            newName: newName,
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool 6: set_strategy (Strategic Layer) ----
  server.tool(
    'set_strategy',
    'Set the high-level strategy for your AI tactical brain. A fast AI model automatically handles per-tick movement and bomb decisions based on this strategy. You are the strategic commander — set the overall approach and the tactical brain executes it every tick. Call this every 2-3 ticks (6-9 seconds) or when the situation changes significantly.',
    {
      mode: z.enum(['aggressive', 'defensive', 'balanced', 'collect_powerups', 'flee'])
        .describe('Strategy mode: aggressive (hunt players), defensive (avoid fights), balanced (adaptive), collect_powerups (prioritize items), flee (escape danger)'),
      targetPlayer: z.string().optional()
        .describe('Target player name or ID to focus on (for aggressive mode)'),
      priorities: z.array(z.string()).optional()
        .describe('Ordered priority list, e.g. ["survive", "attack player-2", "collect powerups"]'),
      directive: z.string().max(200).optional()
        .describe('Free-text tactical directive for the AI brain, e.g. "focus on top-left area" or "avoid center"'),
    },
    async ({ mode, targetPlayer, priorities, directive }) => {
      const engine = getEngine();
      const state = engine.getState();

      // Resolve target player
      let targetPlayerId: string | null = null;
      if (targetPlayer) {
        const target = state.players.find(p =>
          p.name.toLowerCase() === targetPlayer.toLowerCase() || p.id === targetPlayer
        );
        if (target && target.alive) {
          targetPlayerId = target.id;
        }
      }

      const updated = setStrategy(playerId, {
        mode: mode as StrategyMode,
        targetPlayerId,
        priorities: priorities ?? [],
        customDirective: directive ?? null,
        lastUpdatedTick: state.tick,
      });

      pushEvent(playerId, {
        tick: state.tick,
        type: 'strategy_changed',
        details: `Strategy changed to ${mode}${targetPlayer ? ` targeting ${targetPlayer}` : ''}`,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            strategy: updated,
            message: `Strategy updated to "${mode}". The tactical AI brain will now follow this strategy for per-tick decisions.`,
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool 7: get_tactical_status (Strategic Layer) ----
  server.tool(
    'get_tactical_status',
    'Check what the tactical AI brain is doing. Returns the current strategy, recent AI decisions (last 3 ticks), pending strategic events (damage taken, eliminations, etc.), and whether the AI is using fallback mode. Use this to monitor and adjust your strategy.',
    {},
    async () => {
      const engine = getEngine();
      const state = engine.getState();
      const strategy = getStrategy(playerId);
      const events = getEvents(playerId);

      // Find the brain for this player (may be a bot or MCP player)
      const brain = getAiBrain(state.roomId, playerId);

      const recentDecisions = brain?.getRecentDecisions(3) ?? [];
      const isFallback = brain?.isFallbackMode() ?? true;

      // Clear events after reading
      clearEvents(playerId);

      const player = engine.getPlayer(playerId);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            currentStrategy: strategy,
            recentDecisions: recentDecisions.map(d => ({
              tick: d.tick,
              action: d.action,
              reasoning: d.reasoning,
              wasFallback: d.wasFallback,
              latencyMs: d.latencyMs,
            })),
            pendingEvents: events.map(e => ({
              tick: e.tick,
              type: e.type,
              details: e.details,
            })),
            isFallbackMode: isFallback,
            brainRegistered: Boolean(brain),
            geminiDiagnostics: getGeminiDiagnostics(),
            playerStatus: player ? {
              alive: player.alive,
              health: player.health,
              position: { x: player.x, y: player.y },
            } : null,
            currentTick: state.tick,
            tip: 'Adjust strategy with set_strategy if the tactical AI is not performing well. Use override_next_action for urgent corrections.',
          }, null, 2),
        }],
      };
    },
  );

  // ---- Tool 8: override_next_action (Strategic Layer) ----
  server.tool(
    'override_next_action',
    'Directly queue an action for the next tick, bypassing the tactical AI brain. Use this when you spot something critical that the AI might miss. The override applies to ONE tick only, then the tactical brain resumes control.',
    {
      action: z.enum(['move', 'bomb']).describe('The action type'),
      direction: z.enum(['up', 'down', 'left', 'right']).optional()
        .describe('Direction (required for move action)'),
    },
    async ({ action, direction }) => {
      const engine = getEngine();

      if (action === 'move' && !direction) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, error: 'Direction required for move action' }),
          }],
        };
      }

      // Find the brain for this player
      const brain = getAiBrain(engine.getState().roomId, playerId);

      if (brain) {
        const playerAction = action === 'move'
          ? { type: 'move' as const, direction: direction! }
          : { type: 'place_bomb' as const };
        brain.setOverride(playerAction);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Override set: ${action}${direction ? ` ${direction}` : ''} will execute next tick. Tactical brain resumes after.`,
            }),
          }],
        };
      }

      // If no brain (MCP player, not a bot), queue directly
      const playerAction = action === 'move'
        ? { type: 'move' as const, direction: direction! }
        : { type: 'place_bomb' as const };
      const result = engine.queueAction(playerId, playerAction);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: result.accepted,
            message: result.message,
          }),
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

function getOpeningActionPlan(
  engine: GameEngine,
  playerId: string,
): {
  immediateSequence: Array<{ tool: string; args?: { direction: Direction }; purpose: string }>;
  recommendedMove: Direction | null;
  reason: string;
} {
  const player = engine.getPlayer(playerId);
  if (!player) {
    return {
      immediateSequence: [
        { tool: 'get_my_status', purpose: 'Re-sync your current position before taking any opening action.' },
      ],
      recommendedMove: null,
      reason: 'Player not found in engine state; re-sync first.',
    };
  }

  const availableMoves: Direction[] = [];
  if (engine.canMoveToPosition(player.x, player.y - 1)) availableMoves.push('up');
  if (engine.canMoveToPosition(player.x, player.y + 1)) availableMoves.push('down');
  if (engine.canMoveToPosition(player.x - 1, player.y)) availableMoves.push('left');
  if (engine.canMoveToPosition(player.x + 1, player.y)) availableMoves.push('right');

  const preferredMoves = getPreferredOpeningDirections(player.x, player.y);
  const recommendedMove = preferredMoves.find(direction => availableMoves.includes(direction)) ?? availableMoves[0] ?? null;

  const immediateSequence: Array<{ tool: string; args?: { direction: Direction }; purpose: string }> = [
    { tool: 'get_my_status', purpose: 'Read exact availableMoves and confirm you are alive at tick 1.' },
  ];

  if (recommendedMove) {
    immediateSequence.push({
      tool: 'move',
      args: { direction: recommendedMove },
      purpose: 'Take your first action immediately instead of idling after the match starts.',
    });
  }

  return {
    immediateSequence,
    recommendedMove,
    reason: recommendedMove
      ? `Open by moving ${recommendedMove} to leave spawn and head toward the center lane.`
      : 'No legal opening move detected; call get_game_state next and evaluate a bomb only if you have a safe escape route.',
  };
}

function getPreferredOpeningDirections(x: number, y: number): Direction[] {
  const centerX = 6;
  const centerY = 6;

  const horizontal = x < centerX ? 'right' : x > centerX ? 'left' : null;
  const vertical = y < centerY ? 'down' : y > centerY ? 'up' : null;

  const ordered: Direction[] = [];
  if (horizontal && Math.abs(centerX - x) >= Math.abs(centerY - y)) ordered.push(horizontal);
  if (vertical) ordered.push(vertical);
  if (horizontal && !ordered.includes(horizontal)) ordered.push(horizontal);

  for (const direction of ['up', 'down', 'left', 'right'] as Direction[]) {
    if (!ordered.includes(direction)) {
      ordered.push(direction);
    }
  }

  return ordered;
}
