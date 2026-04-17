// ============================================================
// King of Claws — AI Controller Registry (TacticalBrain-powered)
// ============================================================
// Each registered AI-controlled player gets a TacticalBrain.
// This includes both built-in bots and MCP-controlled players.

import type { GameEngine } from '../game/engine.js';
import { TacticalBrain } from '../ai/tactical-brain.js';
import { clearStrategy } from '../ai/strategy-store.js';

const BOT_NAMES = ['Claw-α', 'Claw-β', 'Claw-γ', 'Claw-δ'];
let botCounter = 0;

interface AiBot {
  id: string;
  name: string;
  brain: TacticalBrain;
  source: 'bot' | 'mcp';
}

const activeBots = new Map<string, AiBot[]>(); // roomId → controllers

export function registerAiController(
  roomId: string,
  playerId: string,
  playerName: string,
  engine: GameEngine,
  source: 'bot' | 'mcp',
): TacticalBrain {
  const existing = activeBots.get(roomId)?.find(bot => bot.id === playerId)?.brain;
  if (existing) {
    return existing;
  }

  const brain = new TacticalBrain(playerId, engine);
  const bots = activeBots.get(roomId) || [];
  bots.push({ id: playerId, name: playerName, brain, source });
  activeBots.set(roomId, bots);
  return brain;
}

export function unregisterAiController(roomId: string, playerId: string): void {
  const bots = activeBots.get(roomId);
  if (!bots) return;

  const nextBots = bots.filter(bot => bot.id !== playerId);
  clearStrategy(playerId);

  if (nextBots.length === 0) {
    activeBots.delete(roomId);
    return;
  }

  activeBots.set(roomId, nextBots);
}

/**
 * Spawn an AI bot into a room. Returns bot name or null if room full.
 */
export function spawnBot(roomId: string, engine: GameEngine): string | null {
  if (engine.getPlayerCount() >= 4) return null;

  const name = BOT_NAMES[botCounter % BOT_NAMES.length] + (botCounter >= BOT_NAMES.length ? `-${Math.floor(botCounter / BOT_NAMES.length)}` : '');
  botCounter++;
  const id = `bot-${name}`;

  const player = engine.addPlayer(id, name);
  if (!player) return null;

  registerAiController(roomId, id, name, engine, 'bot');

  return name;
}

/**
 * Run all bot decisions for a room. Called from the engine pre-tick callback.
 * Returns when all bot brains have made their decisions.
 */
export async function runBotDecisions(roomId: string): Promise<void> {
  const bots = activeBots.get(roomId);
  if (!bots || bots.length === 0) return;

  // Run all bot decisions in parallel
  await Promise.all(
    bots.map(bot => bot.brain.decide().catch(err => {
      console.error(`[Bot] Brain error for ${bot.id}:`, err);
    }))
  );
}

/**
 * Get the TacticalBrain for a specific bot.
 */
export function getBotBrain(roomId: string, botId: string): TacticalBrain | undefined {
  const bots = activeBots.get(roomId);
  return bots?.find(b => b.id === botId)?.brain;
}

export function getAiBrain(roomId: string, playerId: string): TacticalBrain | undefined {
  return getBotBrain(roomId, playerId);
}

/**
 * Get all bot brains for a room.
 */
export function getAllBotBrains(roomId: string): TacticalBrain[] {
  const bots = activeBots.get(roomId);
  return bots?.map(b => b.brain) ?? [];
}

export function getAllAiBrains(roomId: string): TacticalBrain[] {
  return getAllBotBrains(roomId);
}

export function getAiControllerSummary(roomId?: string): Array<{
  roomId: string;
  playerId: string;
  playerName: string;
  source: 'bot' | 'mcp';
}> {
  const roomIds = roomId ? [roomId] : Array.from(activeBots.keys());
  return roomIds.flatMap(currentRoomId =>
    (activeBots.get(currentRoomId) ?? []).map(controller => ({
      roomId: currentRoomId,
      playerId: controller.id,
      playerName: controller.name,
      source: controller.source,
    }))
  );
}

export async function runAiControllerDecisions(roomId: string): Promise<void> {
  await runBotDecisions(roomId);
}

/**
 * Remove all bots from a room.
 */
export function clearBots(roomId: string): void {
  const bots = activeBots.get(roomId);
  if (bots) {
    for (const bot of bots) {
      clearStrategy(bot.id);
    }
    activeBots.delete(roomId);
  }
}

export function clearAiControllers(roomId: string): void {
  clearBots(roomId);
}
