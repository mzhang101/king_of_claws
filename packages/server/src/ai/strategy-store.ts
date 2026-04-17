// ============================================================
// King of Claws — Strategy Store (Per-Player Strategic State)
// ============================================================
// Written by OpenClaw (strategic overseer), read by TacticalBrain each tick.

export type StrategyMode = 'aggressive' | 'defensive' | 'balanced' | 'collect_powerups' | 'flee';

export interface StrategyState {
  mode: StrategyMode;
  targetPlayerId: string | null;
  priorities: string[];
  customDirective: string | null;
  lastUpdatedTick: number;
  lastAnalysis: string | null;
}

export interface StrategicEvent {
  tick: number;
  type: 'damage_taken' | 'player_eliminated' | 'powerup_collected' | 'low_health' | 'bomb_nearby' | 'strategy_changed';
  details: string;
  timestamp: number;
}

const strategies = new Map<string, StrategyState>();
const eventQueues = new Map<string, StrategicEvent[]>();

const MAX_EVENTS = 20;

function defaultStrategy(): StrategyState {
  return {
    mode: 'balanced',
    targetPlayerId: null,
    priorities: ['survive', 'collect_powerups', 'attack'],
    customDirective: null,
    lastUpdatedTick: 0,
    lastAnalysis: null,
  };
}

export function getStrategy(playerId: string): StrategyState {
  return strategies.get(playerId) ?? defaultStrategy();
}

export function setStrategy(playerId: string, partial: Partial<StrategyState>): StrategyState {
  const current = getStrategy(playerId);
  const updated = { ...current, ...partial };
  strategies.set(playerId, updated);
  return updated;
}

export function clearStrategy(playerId: string): void {
  strategies.delete(playerId);
  eventQueues.delete(playerId);
}

// ---- Strategic Events ----

export function pushEvent(playerId: string, event: Omit<StrategicEvent, 'timestamp'>): void {
  const queue = eventQueues.get(playerId) ?? [];
  queue.push({ ...event, timestamp: Date.now() });
  if (queue.length > MAX_EVENTS) queue.shift();
  eventQueues.set(playerId, queue);
}

export function getEvents(playerId: string): StrategicEvent[] {
  return eventQueues.get(playerId) ?? [];
}

export function clearEvents(playerId: string): void {
  eventQueues.set(playerId, []);
}
