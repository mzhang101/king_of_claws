// ============================================================
// King of Claws — Built-in Bot (runs inside server process)
// ============================================================
// No MCP connection needed — directly calls engine methods.

import type { GameEngine } from '../game/engine.js';

const BOT_NAMES = ['Claw-α', 'Claw-β', 'Claw-γ', 'Claw-δ'];
let botCounter = 0;

interface InternalBot {
  id: string;
  name: string;
  interval: ReturnType<typeof setInterval>;
}

const activeBots = new Map<string, InternalBot[]>(); // roomId → bots

/**
 * Spawn a built-in bot into a room. Returns bot name or null if room full.
 */
export function spawnBot(roomId: string, engine: GameEngine): string | null {
  if (engine.getPlayerCount() >= 4) return null;

  const name = BOT_NAMES[botCounter % BOT_NAMES.length] + (botCounter >= BOT_NAMES.length ? `-${Math.floor(botCounter / BOT_NAMES.length)}` : '');
  botCounter++;
  const id = `bot-${name}`;

  const player = engine.addPlayer(id, name);
  if (!player) return null;

  // Bot decision loop — runs every 400-800ms (simulates LLM thinking)
  const interval = setInterval(() => {
    botTick(id, engine);
  }, 4000 + Math.random() * 4000);

  const bots = activeBots.get(roomId) || [];
  bots.push({ id, name, interval });
  activeBots.set(roomId, bots);

  return name;
}

/**
 * One bot decision tick.
 */
function botTick(botId: string, engine: GameEngine): void {
  if (engine.getStatus() !== 'playing') return;

  const player = engine.getPlayer(botId);
  if (!player || !player.alive) return;

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
    // Flee: pick a direction that moves away from threats
    const safeDir = available.find(d => {
      const [dx, dy] = offsets[d];
      const nx = player.x + dx;
      const ny = player.y + dy;
      return !nearbyBombs.some(b =>
        (b.x === nx && Math.abs(b.y - ny) <= b.range) ||
        (b.y === ny && Math.abs(b.x - nx) <= b.range)
      ) && engine.isPositionSafe(nx, ny);
    }) || available[Math.floor(Math.random() * available.length)];
    engine.queueAction(botId, { type: 'move', direction: safeDir });
  } else if (Math.random() < 0.25 && player.activeBombs < player.bombCount) {
    // Place bomb occasionally
    engine.queueAction(botId, { type: 'place_bomb' });
  } else if (available.length > 0) {
    // Random walk
    const dir = available[Math.floor(Math.random() * available.length)];
    engine.queueAction(botId, { type: 'move', direction: dir });
  }
}

/**
 * Remove all bots from a room.
 */
export function clearBots(roomId: string): void {
  const bots = activeBots.get(roomId);
  if (bots) {
    for (const bot of bots) {
      clearInterval(bot.interval);
    }
    activeBots.delete(roomId);
  }
}
