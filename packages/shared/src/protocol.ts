// ============================================================
// King of Claws — WebSocket Protocol Types
// ============================================================

import type { GameState, RoomSummary, Position, MatchStats } from './types.js';

// -- Client → Server Messages --
export type ClientMessage =
  | { type: 'list_rooms' }
  | { type: 'create_room'; name: string }
  | { type: 'join_room'; roomId: string }
  | { type: 'leave_room' }
  | { type: 'start_game'; roomId: string };

// -- Server → Client Messages --
export type ServerMessage =
  | { type: 'room_list'; rooms: RoomSummary[] }
  | { type: 'room_created'; roomId: string; name: string }
  | { type: 'game_state'; state: GameState }
  | { type: 'player_joined'; playerId: string; playerName: string; playerCount: number }
  | { type: 'player_left'; playerId: string; playerCount: number }
  | { type: 'game_starting'; countdownSeconds: number }
  | { type: 'game_over'; winnerId: string | null; winnerName: string | null; stats: MatchStats }
  | { type: 'game_event'; event: GameEvent }
  | { type: 'error'; message: string };

// -- Game Events (for frontend animations) --
export type GameEvent =
  | { event: 'bomb_placed'; x: number; y: number; playerId: string }
  | { event: 'bomb_exploded'; x: number; y: number; tiles: Position[] }
  | { event: 'player_damaged'; playerId: string; health: number; source: 'bomb' | 'zone' }
  | { event: 'player_eliminated'; playerId: string; playerName: string }
  | { event: 'powerup_collected'; playerId: string; powerupType: string; x: number; y: number }
  | { event: 'zone_shrinking'; phase: number; safeMinX: number; safeMaxX: number; safeMinY: number; safeMaxY: number }
  | { event: 'brick_destroyed'; x: number; y: number }
  | { event: 'airdrop_landed'; x: number; y: number; powerUpType: string };
