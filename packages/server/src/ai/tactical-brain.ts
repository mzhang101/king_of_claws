// ============================================================
// King of Claws — Tactical Brain (Per-Tick AI Decision Engine)
// ============================================================
// Uses Gemini Flash for fast tactical decisions each tick.
// Falls back to rule-based logic if Gemini fails or is unconfigured.

import type { GameEngine } from '../game/engine.js';
import type { PlayerAction, AgentActionLog } from '@king-of-claws/shared';
import { generateTacticalDecision, isGeminiConfigured } from './gemini-client.js';
import { buildTacticalPrompt } from './prompt-builder.js';
import { ruleFallbackDecision } from './rule-fallback.js';
import { getStrategy, pushEvent } from './strategy-store.js';
import { recordAiError, recordTacticalDecision } from './telemetry-store.js';
import type { TacticalResponse } from './gemini-client.js';

export interface TacticalDecisionLog {
  tick: number;
  action: string;
  reasoning: string;
  wasFallback: boolean;
  strategyMode: string;
  latencyMs: number;
}

export class TacticalBrain {
  readonly playerId: string;
  private engine: GameEngine;
  private decisionLog: TacticalDecisionLog[] = [];
  private lastDecisionTick = -1;
  private previousHealth = -1;
  private overrideAction: PlayerAction | null = null;

  // Track max log entries
  private static readonly MAX_LOG = 10;

  constructor(playerId: string, engine: GameEngine) {
    this.playerId = playerId;
    this.engine = engine;
  }

  /**
   * Set a one-time override action (used by OpenClaw's override_next_action tool).
   */
  setOverride(action: PlayerAction): void {
    this.overrideAction = action;
  }

  /**
   * Make a decision for the current tick.
   * Returns the action taken, or null if no action was possible.
   */
  async decide(): Promise<PlayerAction | null> {
    const player = this.engine.getPlayer(this.playerId);
    if (!player || !player.alive) return null;
    if (this.engine.getStatus() !== 'playing') return null;

    const currentTick = this.engine.getCurrentTick();
    if (this.lastDecisionTick >= currentTick) return null; // Already decided this tick
    this.lastDecisionTick = currentTick;

    // Detect health changes for strategic events
    this.detectEvents(player.health, currentTick);

    // Check for override
    if (this.overrideAction) {
      const action = this.overrideAction;
      this.overrideAction = null;
      const result = this.engine.queueAction(this.playerId, action);
      if (result.accepted) {
        this.logDecision(currentTick, action, 'Override from strategic layer', false, 0);
        this.injectActionLog(action, 'Override from strategic layer', false);
        recordTacticalDecision(this.playerId, currentTick, action.type === 'move' ? `move_${action.direction}` : 'place_bomb', 'Override from strategic layer', 0, false);
        return action;
      }
    }

    const strategy = getStrategy(this.playerId);
    const startMs = Date.now();

    // Try Gemini Flash first
    let tacticalResponse: TacticalResponse | null = null;
    let wasFallback = false;

    if (isGeminiConfigured()) {
      const prompt = buildTacticalPrompt(this.engine, this.playerId, strategy);
      if (prompt) {
        tacticalResponse = await generateTacticalDecision(prompt);
      }
    }

    let action: PlayerAction | null = null;

    if (tacticalResponse && tacticalResponse.action !== 'wait') {
      action = this.responseToAction(tacticalResponse);
    }

    // Fallback to rule-based logic
    if (!action) {
      action = ruleFallbackDecision(this.playerId, this.engine);
      wasFallback = !tacticalResponse; // Only count as fallback if Gemini didn't respond at all
    }

    const latencyMs = Date.now() - startMs;

    if (action) {
      const result = this.engine.queueAction(this.playerId, action);
      if (result.accepted) {
        const reasoning = tacticalResponse?.reasoning ?? (wasFallback ? 'Rule-based fallback' : 'AI decided to act');
        const actionName = action.type === 'move' ? `move_${action.direction}` : 'place_bomb';
        this.logDecision(currentTick, action, reasoning, wasFallback, latencyMs);
        this.injectActionLog(action, reasoning, wasFallback);
        recordTacticalDecision(this.playerId, currentTick, actionName, reasoning, latencyMs, wasFallback);
        return action;
      }
    }

    // Log even if no action
    this.logDecision(currentTick, null, tacticalResponse?.reasoning ?? 'No valid action', wasFallback, latencyMs);
    recordAiError(this.playerId, currentTick, tacticalResponse?.reasoning ?? 'No valid action was accepted for this tick.');
    return null;
  }

  /**
   * Get the recent decision log.
   */
  getDecisionLog(): TacticalDecisionLog[] {
    return [...this.decisionLog];
  }

  /**
   * Get the last N decisions.
   */
  getRecentDecisions(n: number = 3): TacticalDecisionLog[] {
    return this.decisionLog.slice(-n);
  }

  /**
   * Whether the brain is using fallback mode (Gemini not configured).
   */
  isFallbackMode(): boolean {
    return !isGeminiConfigured();
  }

  // ---- Private Helpers ----

  private responseToAction(resp: TacticalResponse): PlayerAction | null {
    if (resp.action === 'move' && resp.direction) {
      return { type: 'move', direction: resp.direction };
    }
    if (resp.action === 'bomb') {
      return { type: 'place_bomb' };
    }
    return null;
  }

  private logDecision(
    tick: number,
    action: PlayerAction | null,
    reasoning: string,
    wasFallback: boolean,
    latencyMs: number,
  ): void {
    const strategy = getStrategy(this.playerId);
    let actionStr = 'none';
    if (action) {
      actionStr = action.type === 'move' ? `move_${action.direction}` : 'place_bomb';
    }

    this.decisionLog.push({
      tick,
      action: actionStr,
      reasoning,
      wasFallback,
      strategyMode: strategy.mode,
      latencyMs,
    });

    if (this.decisionLog.length > TacticalBrain.MAX_LOG) {
      this.decisionLog.shift();
    }
  }

  private detectEvents(currentHealth: number, tick: number): void {
    if (this.previousHealth >= 0 && currentHealth < this.previousHealth) {
      pushEvent(this.playerId, {
        tick,
        type: 'damage_taken',
        details: `Health dropped from ${this.previousHealth} to ${currentHealth}`,
      });
    }
    if (currentHealth <= 2 && (this.previousHealth > 2 || this.previousHealth < 0)) {
      pushEvent(this.playerId, {
        tick,
        type: 'low_health',
        details: `Health is low: ${currentHealth}`,
      });
    }
    this.previousHealth = currentHealth;
  }

  /**
   * Inject an action log entry into the engine's recentActions for spectator/frontend display.
   */
  private injectActionLog(
    action: PlayerAction,
    reasoning: string,
    wasFallback: boolean,
  ): void {
    const player = this.engine.getPlayer(this.playerId);
    if (!player) return;

    const strategy = getStrategy(this.playerId);
    const actionStr = action.type === 'move' ? `move_${action.direction}` : 'place_bomb';

    const log: AgentActionLog = {
      playerId: player.id,
      playerName: player.name,
      tick: this.engine.getCurrentTick(),
      action: actionStr,
      thought: reasoning,
      timestamp: Date.now(),
      aiReasoning: reasoning,
      strategyMode: strategy.mode,
      wasFallback,
    };

    this.engine.addActionLog(log);
  }
}
