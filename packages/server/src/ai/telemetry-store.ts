// ============================================================
// King of Claws — AI Telemetry Store
// ============================================================
// Keeps a lightweight timeline of strategic and tactical activity per player.

import type { AiEvent, AiPlayerTelemetry } from '@king-of-claws/shared';
import { isGeminiConfigured } from './gemini-client.js';

const telemetryByPlayer = new Map<string, AiPlayerTelemetry>();
const MAX_EVENTS = 12;

function createDefaultTelemetry(
  playerId: string,
  source: 'mcp' | 'bot' = 'bot',
): AiPlayerTelemetry {
  return {
    playerId,
    source,
    tacticalRegistered: false,
    strategicAttached: source === 'mcp',
    strategicCallCount: 0,
    lastStrategicTool: null,
    lastStrategicAt: null,
    lastStrategicSummary: null,
    lastStrategyMode: null,
    lastDirective: null,
    lastDecisionAt: null,
    lastDecisionTick: null,
    lastDecisionAction: null,
    lastDecisionReasoning: null,
    lastDecisionLatencyMs: null,
    usingFallback: !isGeminiConfigured(),
    recentEvents: [],
  };
}

function pushEvent(telemetry: AiPlayerTelemetry, event: Omit<AiEvent, 'id'>): void {
  telemetry.recentEvents.push({
    id: `${event.tick}-${event.layer}-${event.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...event,
  });

  if (telemetry.recentEvents.length > MAX_EVENTS) {
    telemetry.recentEvents.shift();
  }
}

export function ensureAiTelemetry(
  playerId: string,
  source: 'mcp' | 'bot' = 'bot',
): AiPlayerTelemetry {
  const existing = telemetryByPlayer.get(playerId);
  if (existing) {
    existing.source = source;
    if (source === 'mcp') {
      existing.strategicAttached = true;
    }
    return existing;
  }

  const created = createDefaultTelemetry(playerId, source);
  telemetryByPlayer.set(playerId, created);
  return created;
}

export function registerAiTelemetry(
  playerId: string,
  source: 'mcp' | 'bot',
  tick: number,
): void {
  const telemetry = ensureAiTelemetry(playerId, source);
  telemetry.tacticalRegistered = true;
  telemetry.source = source;
  telemetry.usingFallback = !isGeminiConfigured();
  if (source === 'mcp') {
    telemetry.strategicAttached = true;
  }

  pushEvent(telemetry, {
    tick,
    timestamp: Date.now(),
    layer: 'system',
    kind: 'controller_registered',
    summary: source === 'mcp'
      ? 'OpenClaw strategic layer attached to this player.'
      : 'Built-in bot controller attached to this player.',
  });
}

export function recordStrategicTool(
  playerId: string,
  tick: number,
  tool: 'set_strategy' | 'get_tactical_status' | 'override_next_action',
  summary: string,
  options?: {
    mode?: string | null;
    directive?: string | null;
  },
): void {
  const telemetry = ensureAiTelemetry(playerId, 'mcp');
  telemetry.strategicAttached = true;
  telemetry.strategicCallCount++;
  telemetry.lastStrategicTool = tool;
  telemetry.lastStrategicAt = Date.now();
  telemetry.lastStrategicSummary = summary;
  if (options?.mode !== undefined) {
    telemetry.lastStrategyMode = options.mode;
  }
  if (options?.directive !== undefined) {
    telemetry.lastDirective = options.directive;
  }

  pushEvent(telemetry, {
    tick,
    timestamp: Date.now(),
    layer: 'strategic',
    kind: tool,
    summary,
  });
}

export function recordTacticalDecision(
  playerId: string,
  tick: number,
  action: string,
  reasoning: string,
  latencyMs: number,
  usingFallback: boolean,
): void {
  const telemetry = ensureAiTelemetry(playerId);
  telemetry.tacticalRegistered = true;
  telemetry.lastDecisionAt = Date.now();
  telemetry.lastDecisionTick = tick;
  telemetry.lastDecisionAction = action;
  telemetry.lastDecisionReasoning = reasoning;
  telemetry.lastDecisionLatencyMs = latencyMs;
  telemetry.usingFallback = usingFallback;

  pushEvent(telemetry, {
    tick,
    timestamp: Date.now(),
    layer: 'tactical',
    kind: usingFallback ? 'fallback_decision' : 'gemini_decision',
    summary: `${usingFallback ? 'Fallback' : 'Gemini'} chose ${action} (${latencyMs}ms).`,
    detail: reasoning,
  });
}

export function recordAiError(
  playerId: string,
  tick: number,
  message: string,
): void {
  const telemetry = ensureAiTelemetry(playerId);
  pushEvent(telemetry, {
    tick,
    timestamp: Date.now(),
    layer: 'system',
    kind: 'error',
    summary: message,
  });
}

export function getAiTelemetry(playerId: string): AiPlayerTelemetry | null {
  const telemetry = telemetryByPlayer.get(playerId);
  if (!telemetry) {
    return null;
  }
  return {
    ...telemetry,
    recentEvents: [...telemetry.recentEvents],
  };
}

export function listAiTelemetry(playerIds: string[]): AiPlayerTelemetry[] {
  return playerIds
    .map(playerId => getAiTelemetry(playerId))
    .filter((telemetry): telemetry is AiPlayerTelemetry => telemetry !== null);
}

export function clearAiTelemetry(playerId: string): void {
  telemetryByPlayer.delete(playerId);
}
