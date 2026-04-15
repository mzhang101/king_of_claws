// ============================================================
// King of Claws — Game Engine (Tick-based Game Loop)
// ============================================================

import type {
  GameState,
  GameStatus,
  Player,
  Bomb,
  Explosion,
  PowerUp,
  DangerZone,
  PlayerAction,
  ActionResult,
  TileType as TileTypeEnum,
  Position,
} from '@king-of-claws/shared';
import {
  TileType,
  TICK_INTERVAL_MS,
  COUNTDOWN_SECONDS,
  TICK_RATE,
  MAX_MATCH_DURATION_TICKS,
} from '@king-of-claws/shared';
import type { GameEvent } from '@king-of-claws/shared';

import { generateGrid } from './grid.js';
import { createPlayer, damagePlayer } from './player.js';
import { createBomb, calculateExplosion, createExplosion } from './bomb.js';
import { applyPowerUp, revealPowerUp } from './powerup.js';
import { createDangerZone, updateDangerZone, isInSafeZone } from './zone.js';
import { validateMove, validatePlaceBomb, canMoveTo } from './actions.js';

export type EngineEventHandler = (event: GameEvent) => void;

export class GameEngine {
  private grid: TileTypeEnum[][] = [];
  private players: Map<string, Player> = new Map();
  private bombs: Bomb[] = [];
  private explosions: Explosion[] = [];
  private powerups: PowerUp[] = [];
  private dangerZone!: DangerZone;
  private actionQueue: Map<string, PlayerAction> = new Map();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private currentTick = 0;
  private status: GameStatus = 'waiting';
  private winner: string | null = null;
  private countdownRemaining: number | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private roomId: string;
  private onStateUpdate?: (state: GameState) => void;
  private onEvent?: EngineEventHandler;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.initMap();
  }

  // ---- Initialization ----

  private initMap(): void {
    const { grid, hiddenPowerups } = generateGrid();
    this.grid = grid;
    this.powerups = hiddenPowerups;
    this.dangerZone = createDangerZone();
    this.bombs = [];
    this.explosions = [];
    this.currentTick = 0;
    this.winner = null;
  }

  // ---- Player Management ----

  addPlayer(id: string, name: string): Player | null {
    if (this.players.size >= 4) return null;
    if (this.players.has(id)) return this.players.get(id)!;

    const spawnIndex = this.players.size;
    const player = createPlayer(id, name, spawnIndex);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.connected = false;
      if (this.status === 'waiting') {
        this.players.delete(id);
      }
    }
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getAlivePlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.alive);
  }

  // ---- Game Lifecycle ----

  setOnStateUpdate(handler: (state: GameState) => void): void {
    this.onStateUpdate = handler;
  }

  setOnEvent(handler: EngineEventHandler): void {
    this.onEvent = handler;
  }

  startCountdown(): void {
    if (this.status !== 'waiting') return;
    if (this.players.size < 2) return;

    this.status = 'countdown';
    this.countdownRemaining = COUNTDOWN_SECONDS;

    this.countdownInterval = setInterval(() => {
      if (this.countdownRemaining !== null) {
        this.countdownRemaining--;
        this.broadcastState();
        if (this.countdownRemaining <= 0) {
          if (this.countdownInterval) clearInterval(this.countdownInterval);
          this.countdownInterval = null;
          this.startGame();
        }
      }
    }, 1000);
  }

  private startGame(): void {
    this.status = 'playing';
    this.countdownRemaining = null;
    this.currentTick = 0;

    // Start tick loop
    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

    this.broadcastState();
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  reset(): void {
    this.stop();
    this.initMap();
    this.status = 'waiting';
    this.countdownRemaining = null;

    // Re-create players at spawn positions
    const existingPlayers = Array.from(this.players.values());
    this.players.clear();
    for (const p of existingPlayers) {
      if (p.connected) {
        this.addPlayer(p.id, p.name);
      }
    }
  }

  // ---- Action Queue ----

  /**
   * Queue an action for a player. Only the latest action per tick is kept.
   */
  queueAction(playerId: string, action: PlayerAction): ActionResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { accepted: false, message: 'Player not found in this game.' };
    }

    if (this.status !== 'playing') {
      return { accepted: false, message: `Game is not active (status: ${this.status}).` };
    }

    if (!player.alive) {
      return { accepted: false, message: 'You have been eliminated.' };
    }

    // Rate limit: one action per tick
    if (player.lastActionTick >= this.currentTick) {
      return { accepted: false, message: 'Action rate limit: you already submitted an action this tick. Wait for next tick.' };
    }

    // Validate the action
    let result: ActionResult;
    if (action.type === 'move') {
      result = validateMove(player, action.direction, this.grid, this.bombs);
    } else {
      result = validatePlaceBomb(player, this.bombs);
    }

    if (result.accepted) {
      this.actionQueue.set(playerId, action);
      player.lastActionTick = this.currentTick;
    }

    return result;
  }

  // ---- Core Tick Loop ----

  private tick(): void {
    this.currentTick++;

    // 1. Process queued actions
    this.processActions();

    // 2. Update bomb timers & detonate
    this.updateBombs();

    // 3. Fade out explosions
    this.updateExplosions();

    // 4. Check power-up pickups
    this.checkPowerUps();

    // 5. Update danger zone
    this.updateZone();

    // 6. Apply zone damage
    this.applyZoneDamage();

    // 7. Check win condition
    this.checkWinCondition();

    // 8. Broadcast state to spectators
    this.broadcastState();

    // 9. Clear action queue
    this.actionQueue.clear();

    // 10. Time limit check
    if (this.currentTick >= MAX_MATCH_DURATION_TICKS && this.status === 'playing') {
      this.endGameByTimeout();
    }
  }

  private processActions(): void {
    for (const [playerId, action] of this.actionQueue) {
      const player = this.players.get(playerId);
      if (!player || !player.alive) continue;

      if (action.type === 'move') {
        const result = validateMove(player, action.direction, this.grid, this.bombs);
        if (result.accepted && result.projectedPosition) {
          player.x = result.projectedPosition.x;
          player.y = result.projectedPosition.y;
        }
      } else if (action.type === 'place_bomb') {
        const result = validatePlaceBomb(player, this.bombs);
        if (result.accepted) {
          const bomb = createBomb(player.id, player.x, player.y, player.bombRange);
          this.bombs.push(bomb);
          player.activeBombs++;

          this.emitEvent({
            event: 'bomb_placed',
            x: player.x,
            y: player.y,
            playerId: player.id,
          });
        }
      }
    }
  }

  private updateBombs(): void {
    const detonatedIds = new Set<string>();

    // Tick down all bombs
    for (const bomb of this.bombs) {
      bomb.ticksRemaining--;
    }

    // Find bombs ready to detonate
    const toDetonate = this.bombs.filter(b => b.ticksRemaining <= 0 && !detonatedIds.has(b.id));

    // Process detonations (including chain reactions)
    const detonateQueue = [...toDetonate];
    while (detonateQueue.length > 0) {
      const bomb = detonateQueue.shift()!;
      if (detonatedIds.has(bomb.id)) continue;
      detonatedIds.add(bomb.id);

      const { affectedTiles, destroyedBricks, chainBombIds } = calculateExplosion(
        bomb,
        this.grid,
        this.bombs,
      );

      // Create visual explosion
      const explosion = createExplosion(affectedTiles);
      this.explosions.push(explosion);

      this.emitEvent({
        event: 'bomb_exploded',
        x: bomb.x,
        y: bomb.y,
        tiles: affectedTiles,
      });

      // Destroy bricks
      for (const brick of destroyedBricks) {
        this.grid[brick.y][brick.x] = TileType.EMPTY;
        this.emitEvent({ event: 'brick_destroyed', x: brick.x, y: brick.y });

        // Reveal hidden power-ups
        revealPowerUp(this.powerups, brick.x, brick.y);
      }

      // Damage players in explosion
      for (const tile of affectedTiles) {
        for (const player of this.players.values()) {
          if (player.alive && player.x === tile.x && player.y === tile.y) {
            const killed = damagePlayer(player, 1);
            this.emitEvent({
              event: 'player_damaged',
              playerId: player.id,
              health: player.health,
              source: 'bomb',
            });
            if (killed) {
              this.emitEvent({
                event: 'player_eliminated',
                playerId: player.id,
                playerName: player.name,
              });
            }
          }
        }
      }

      // Queue chain detonations
      for (const chainId of chainBombIds) {
        if (!detonatedIds.has(chainId)) {
          const chainBomb = this.bombs.find(b => b.id === chainId);
          if (chainBomb) {
            detonateQueue.push(chainBomb);
          }
        }
      }

      // Return bomb slot to owner
      const owner = this.players.get(bomb.ownerId);
      if (owner) {
        owner.activeBombs = Math.max(0, owner.activeBombs - 1);
      }
    }

    // Remove detonated bombs
    this.bombs = this.bombs.filter(b => !detonatedIds.has(b.id));
  }

  private updateExplosions(): void {
    for (const exp of this.explosions) {
      exp.ticksRemaining--;
    }
    this.explosions = this.explosions.filter(e => e.ticksRemaining > 0);
  }

  private checkPowerUps(): void {
    for (const player of this.players.values()) {
      if (!player.alive) continue;

      const idx = this.powerups.findIndex(
        p => p.visible && p.x === player.x && p.y === player.y,
      );
      if (idx !== -1) {
        const powerup = this.powerups[idx];
        applyPowerUp(player, powerup);
        this.powerups.splice(idx, 1);

        this.emitEvent({
          event: 'powerup_collected',
          playerId: player.id,
          powerupType: powerup.type,
          x: powerup.x,
          y: powerup.y,
        });
      }
    }
  }

  private updateZone(): void {
    const shrank = updateDangerZone(this.dangerZone);
    if (shrank) {
      this.emitEvent({
        event: 'zone_shrinking',
        phase: this.dangerZone.phase,
        safeMinX: this.dangerZone.safeMinX,
        safeMaxX: this.dangerZone.safeMaxX,
        safeMinY: this.dangerZone.safeMinY,
        safeMaxY: this.dangerZone.safeMaxY,
      });
    }
  }

  private applyZoneDamage(): void {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      if (!isInSafeZone(this.dangerZone, player.x, player.y)) {
        const killed = damagePlayer(player, this.dangerZone.damagePerTick);
        this.emitEvent({
          event: 'player_damaged',
          playerId: player.id,
          health: player.health,
          source: 'zone',
        });
        if (killed) {
          this.emitEvent({
            event: 'player_eliminated',
            playerId: player.id,
            playerName: player.name,
          });
        }
      }
    }
  }

  private checkWinCondition(): void {
    const alive = this.getAlivePlayers();

    if (alive.length <= 1) {
      this.status = 'finished';
      this.winner = alive.length === 1 ? alive[0].id : null;
      this.stop();
    }
  }

  private endGameByTimeout(): void {
    // Most health wins
    const alive = this.getAlivePlayers();
    if (alive.length > 0) {
      alive.sort((a, b) => b.health - a.health);
      this.winner = alive[0].id;
    } else {
      this.winner = null;
    }
    this.status = 'finished';
    this.stop();
  }

  // ---- State Access ----

  getState(): GameState {
    return {
      roomId: this.roomId,
      status: this.status,
      tick: this.currentTick,
      grid: this.grid,
      players: Array.from(this.players.values()),
      bombs: this.bombs,
      explosions: this.explosions,
      powerups: this.powerups.filter(p => p.visible),
      dangerZone: this.dangerZone,
      winner: this.winner,
      countdownRemaining: this.countdownRemaining,
    };
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Check if a position is in the safe zone.
   */
  isPositionSafe(x: number, y: number): boolean {
    return isInSafeZone(this.dangerZone, x, y);
  }

  /**
   * Check if a position can be moved to.
   */
  canMoveToPosition(x: number, y: number): boolean {
    return canMoveTo(x, y, this.grid, this.bombs);
  }

  // ---- Broadcasting ----

  private broadcastState(): void {
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
  }

  private emitEvent(event: GameEvent): void {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }
}
