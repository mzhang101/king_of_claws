// ============================================================
// King of Claws — Room (Single Game Session)
// ============================================================

import { GameEngine } from '../game/engine.js';
import { runBotDecisions } from '../game/bot.js';
import type { GameState, RoomSummary, MatchStats, GameStatus } from '@king-of-claws/shared';
import type { ServerMessage, GameEvent } from '@king-of-claws/shared';
import type { WebSocket } from 'ws';

export class Room {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  private finishedAt: number | null = null;
  private engine: GameEngine;
  private spectators: Set<WebSocket> = new Set();
  private playerNames: Map<string, string> = new Map(); // id → name
  private onRoomStateChange?: () => void;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.createdAt = Date.now();
    this.engine = new GameEngine(id);

    // Wire engine pre-tick callback to run bot AI decisions
    this.engine.setOnPreTick(async () => {
      await runBotDecisions(id);
    });

    // Wire engine events to spectator broadcast
    this.engine.setOnStateUpdate((state) => {
      this.broadcastToSpectators({ type: 'game_state', state });
    });

    this.engine.setOnEvent((event) => {
      this.broadcastToSpectators({ type: 'game_event', event });

      // Check for game over
      if (this.engine.getStatus() === 'finished') {
        this.finishedAt = Date.now();
        const state = this.engine.getState();
        const winnerPlayer = state.players.find(p => p.id === state.winner);
        this.broadcastToSpectators({
          type: 'game_over',
          winnerId: state.winner,
          winnerName: winnerPlayer?.name ?? null,
          stats: this.buildMatchStats(),
        });
      }
    });
  }

  // ---- Engine Access ----

  getEngine(): GameEngine {
    return this.engine;
  }

  getStatus(): GameStatus {
    return this.engine.getStatus();
  }

  getFinishedAt(): number | null {
    return this.finishedAt;
  }

  // ---- Player Events ----

  onPlayerConnected(playerId: string, playerName: string): void {
    this.playerNames.set(playerId, playerName);
    this.broadcastToSpectators({
      type: 'player_joined',
      playerId,
      playerName,
      playerCount: this.engine.getPlayerCount(),
    });
    // Also broadcast full game_state so frontends update in real-time
    this.broadcastToSpectators({ type: 'game_state', state: this.engine.getState() });
    this.onRoomStateChange?.(); // Notify room state changed
  }

  onPlayerDisconnected(playerId: string): void {
    this.broadcastToSpectators({
      type: 'player_left',
      playerId,
      playerCount: this.engine.getPlayerCount(),
    });
    this.onRoomStateChange?.(); // Notify room state changed
  }

  // ---- Game Lifecycle ----

  startGame(): boolean {
    if (this.engine.getPlayerCount() < 2) return false;
    if (this.engine.getStatus() !== 'waiting') return false;

    this.broadcastToSpectators({
      type: 'game_starting',
      countdownSeconds: 5,
    });

    this.engine.startCountdown();
    return true;
  }

  resetGame(): void {
    this.engine.reset();
  }

  // ---- Spectators ----

  addSpectator(ws: WebSocket): void {
    this.spectators.add(ws);
    // Send current state immediately
    const state = this.engine.getState();
    this.sendToClient(ws, { type: 'game_state', state });
  }

  removeSpectator(ws: WebSocket): void {
    this.spectators.delete(ws);
  }

  private broadcastToSpectators(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.spectators) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ---- Summary ----

  getSummary(): RoomSummary {
    return {
      id: this.id,
      name: this.name,
      status: this.engine.getStatus(),
      playerCount: this.engine.getPlayerCount(),
      maxPlayers: 4,
      createdAt: this.createdAt,
    };
  }

  // ---- Match Stats ----

  private buildMatchStats(): MatchStats {
    const state = this.engine.getState();
    return {
      duration: state.tick,
      totalBombsPlaced: 0, // Simplified for MVP
      bricksDestroyed: 0,
      playerStats: state.players.map(p => ({
        id: p.id,
        name: p.name,
        survived: p.alive,
        bombsPlaced: 0,
        powerupsCollected: 0,
        damageDealt: 0,
        damageTaken: 0,
      })),
    };
  }

  // ---- Cleanup ----

  setOnRoomStateChange(callback: () => void): void {
    this.onRoomStateChange = callback;
  }

  destroy(): void {
    this.engine.stop();
    for (const ws of this.spectators) {
      ws.close();
    }
    this.spectators.clear();
  }
}
