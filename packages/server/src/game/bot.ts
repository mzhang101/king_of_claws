// ============================================================
// King of Claws — AI Bot System (TacticalBrain-powered)
// ============================================================
// Each bot is driven by a TacticalBrain (Gemini Flash + rule fallback).
// Decisions happen in the engine pre-tick callback, not on a timer.

import type { GameEngine } from '../game/engine.js';
import { TacticalBrain } from '../ai/tactical-brain.js';
import { clearStrategy } from '../ai/strategy-store.js';

const BOT_NAMES = ['Claw-α', 'Claw-β', 'Claw-γ', 'Claw-δ'];
let botCounter = 0;

interface AiBot {
  id: string;
  name: string;
  brain: TacticalBrain;
}

const activeBots = new Map<string, AiBot[]>(); // roomId → bots

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

  const brain = new TacticalBrain(id, engine);

  const bots = activeBots.get(roomId) || [];
  bots.push({ id, name, brain });
  activeBots.set(roomId, bots);

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

/**
 * Get all bot brains for a room.
 */
export function getAllBotBrains(roomId: string): TacticalBrain[] {
  const bots = activeBots.get(roomId);
  return bots?.map(b => b.brain) ?? [];
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
