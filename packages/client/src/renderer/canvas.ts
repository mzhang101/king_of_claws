// ============================================================
// King of Claws — Canvas Rendering Engine
// ============================================================

import type { GameState, Player, Bomb, Explosion, PowerUp, DangerZone } from '@king-of-claws/shared';
import { TileType, PowerUpType, GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from '@king-of-claws/shared';

// -- Retro Cyberpunk Colors --
const COLORS = {
  ground: '#0a0e27',
  groundAlt: '#0d1129',
  wall: '#1a3a52',
  wallHighlight: '#2a5a7a',
  brick: '#8B4513',
  brickCrack: '#6B3410',
  danger: 'rgba(255, 0, 100, 0.3)',
  dangerEdge: 'rgba(255, 0, 100, 0.7)',
  bomb: '#1a1a1a',
  bombFuse: '#ff00ff',
  explosionCore: '#00ffff',
  explosionOuter: '#ff00ff',
  powerupBomb: '#ff1493',
  powerupRange: '#00ffff',
  powerupSpeed: '#39ff14',
  powerupArmor: '#ffd700',
  powerupHeavyArmor: '#ff8c00',
  powerupHealth: '#ff69b4',
  powerupSpeedBoost: '#7fff00',
  powerupShapeFloppy: '#9370db',
  gridLine: 'rgba(0, 255, 255, 0.08)',
  labelBg: 'rgba(0, 0, 0, 0.85)',
  armorShield: 'rgba(255, 215, 0, 0.4)',
  speedBoostAura: 'rgba(127, 255, 0, 0.3)',
};

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private animFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d')!;
  }

  render(state: GameState): void {
    this.animFrame++;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Layer 1: Ground
    this.drawGround();

    // Layer 2: Danger zone overlay
    this.drawDangerZone(state.dangerZone);

    // Layer 3: Grid (walls, bricks)
    this.drawGrid(state.grid);

    // Layer 4: Power-ups
    this.drawPowerUps(state.powerups);

    // Layer 5: Bombs
    this.drawBombs(state.bombs);

    // Layer 6: Explosions
    this.drawExplosions(state.explosions);

    // Layer 7: Players
    this.drawPlayers(state.players);

    // Layer 8: Labels
    this.drawLabels(state.players);
  }

  private drawGround(): void {
    const ctx = this.ctx;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.ground : COLORS.groundAlt;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawDangerZone(zone: DangerZone): void {
    const ctx = this.ctx;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (x < zone.safeMinX || x > zone.safeMaxX || y < zone.safeMinY || y > zone.safeMaxY) {
          // Pulsing danger effect
          const pulse = 0.15 + 0.1 * Math.sin(this.animFrame * 0.1);
          ctx.fillStyle = `rgba(255, 20, 20, ${pulse})`;
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          // Edge highlight (border of safe zone)
          const isEdge =
            (x === zone.safeMinX - 1 || x === zone.safeMaxX + 1) && y >= zone.safeMinY && y <= zone.safeMaxY ||
            (y === zone.safeMinY - 1 || y === zone.safeMaxY + 1) && x >= zone.safeMinX && x <= zone.safeMaxX;

          if (isEdge) {
            ctx.fillStyle = COLORS.dangerEdge;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
  }

  private drawGrid(grid: number[][]): void {
    const ctx = this.ctx;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TileType.WALL) {
          // Indestructible wall — dark metallic look
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          // Highlight edge
          ctx.fillStyle = COLORS.wallHighlight;
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 8, 3);
          ctx.fillRect(px + 2, py + 2, 3, TILE_SIZE - 8);
        } else if (tile === TileType.BRICK) {
          // Destructible brick — brown with cracks
          ctx.fillStyle = COLORS.brick;
          ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          // Brick pattern
          ctx.strokeStyle = COLORS.brickCrack;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          // Cross pattern
          ctx.beginPath();
          ctx.moveTo(px + TILE_SIZE / 2, py + 3);
          ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE - 3);
          ctx.moveTo(px + 3, py + TILE_SIZE / 2);
          ctx.lineTo(px + TILE_SIZE - 3, py + TILE_SIZE / 2);
          ctx.stroke();
        }
      }
    }
  }

  private drawPowerUps(powerups: PowerUp[]): void {
    const ctx = this.ctx;
    for (const pu of powerups) {
      const px = pu.x * TILE_SIZE + TILE_SIZE / 2;
      const py = pu.y * TILE_SIZE + TILE_SIZE / 2;
      const r = TILE_SIZE * 0.3;

      // Floating animation
      const float = Math.sin(this.animFrame * 0.08 + pu.x + pu.y) * 3;

      ctx.save();
      ctx.translate(px, py + float);

      // Determine color and icon based on type
      let color: string;
      let icon: string;

      switch (pu.type) {
        case PowerUpType.BOMB_COUNT:
          color = COLORS.powerupBomb;
          icon = 'B';
          break;
        case PowerUpType.BOMB_RANGE:
          color = COLORS.powerupRange;
          icon = 'R';
          break;
        case PowerUpType.SPEED:
          color = COLORS.powerupSpeed;
          icon = 'S';
          break;
        case PowerUpType.ARMOR:
          color = COLORS.powerupArmor;
          icon = 'A';
          break;
        case PowerUpType.HEAVY_ARMOR:
          color = COLORS.powerupHeavyArmor;
          icon = 'A+';
          break;
        case PowerUpType.HEALTH_PATCH:
          color = COLORS.powerupHealth;
          icon = 'H';
          break;
        case PowerUpType.SPEED_BOOST:
          color = COLORS.powerupSpeedBoost;
          icon = 'S+';
          break;
        case PowerUpType.SHAPE_FLOPPY:
          color = COLORS.powerupShapeFloppy;
          icon = 'X';
          break;
        default:
          color = COLORS.powerupBomb;
          icon = '?';
      }

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Pixel-style diamond shape
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();

      // Icon text with retro font
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 0);

      ctx.restore();
    }
  }

  private drawBombs(bombs: Bomb[]): void {
    const ctx = this.ctx;
    for (const bomb of bombs) {
      const px = bomb.x * TILE_SIZE + TILE_SIZE / 2;
      const py = bomb.y * TILE_SIZE + TILE_SIZE / 2;

      // Pulsing effect based on remaining time
      const urgency = 1 - bomb.ticksRemaining / 15;
      const pulse = 1 + 0.15 * Math.sin(this.animFrame * (0.2 + urgency * 0.5));
      const r = TILE_SIZE * 0.35 * pulse;

      // Bomb body with pixel-style outline
      ctx.fillStyle = COLORS.bomb;
      ctx.strokeStyle = urgency > 0.7 ? '#ff0000' : '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Fuse glow (cyberpunk magenta)
      ctx.strokeStyle = urgency > 0.7 ? '#ff00ff' : COLORS.bombFuse;
      ctx.lineWidth = 3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, r + 4, -Math.PI * 0.3, Math.PI * 0.1);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Shape indicator for cross bombs
      if (bomb.shape === 'cross') {
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', px, py - r - 8);
      }

      // Timer text (retro style)
      ctx.fillStyle = urgency > 0.7 ? '#ff00ff' : '#00ffff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const secs = (bomb.ticksRemaining / 5).toFixed(1);
      ctx.fillText(secs, px, py);
    }
  }

  private drawExplosions(explosions: Explosion[]): void {
    const ctx = this.ctx;
    for (const exp of explosions) {
      const alpha = exp.ticksRemaining / 3;
      for (const tile of exp.tiles) {
        const px = tile.x * TILE_SIZE;
        const py = tile.y * TILE_SIZE;

        // Cyberpunk explosion gradient (cyan to magenta)
        const grad = ctx.createRadialGradient(
          px + TILE_SIZE / 2, py + TILE_SIZE / 2, 0,
          px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE * 0.6,
        );
        grad.addColorStop(0, `rgba(0, 255, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(255, 0, 255, ${alpha * 0.8})`);
        grad.addColorStop(1, `rgba(255, 0, 100, ${alpha * 0.3})`);

        ctx.fillStyle = grad;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawPlayers(players: Player[]): void {
    const ctx = this.ctx;
    for (const player of players) {
      if (!player.alive) continue;

      const px = player.x * TILE_SIZE + TILE_SIZE / 2;
      const py = player.y * TILE_SIZE + TILE_SIZE / 2;
      const r = TILE_SIZE * 0.38;

      // Speed boost aura
      if (player.speedBoostTicks > 0) {
        const auraSize = r + 8 + Math.sin(this.animFrame * 0.2) * 3;
        ctx.fillStyle = COLORS.speedBoostAura;
        ctx.beginPath();
        ctx.arc(px, py, auraSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Armor shield
      if (player.armor > 0) {
        const shieldSize = r + 6;
        ctx.strokeStyle = player.armor >= 2 ? COLORS.powerupHeavyArmor : COLORS.powerupArmor;
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, shieldSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(px + 2, py + 4, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player body
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Pixel-style outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Initial letter (retro font)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.name.charAt(0).toUpperCase(), px, py);

      // Cross bomb indicator
      if (player.crossBombActive) {
        ctx.fillStyle = COLORS.powerupShapeFloppy;
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText('X', px + r - 4, py - r + 4);
      }
    }
  }

  private drawLabels(players: Player[]): void {
    const ctx = this.ctx;
    for (const player of players) {
      if (!player.alive) continue;

      const px = player.x * TILE_SIZE + TILE_SIZE / 2;
      const py = player.y * TILE_SIZE - 8;

      // Name + health background (terminal style)
      const name = player.name.length > 8 ? player.name.slice(0, 8) : player.name;
      ctx.font = '10px "Courier New", monospace';
      const textWidth = ctx.measureText(name).width + 8;

      ctx.fillStyle = COLORS.labelBg;
      const bgX = px - textWidth / 2 - 2;
      const bgW = textWidth + 4;
      ctx.fillRect(bgX, py - 10, bgW, 22);

      // Pixel border
      ctx.strokeStyle = player.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(bgX, py - 10, bgW, 22);

      // Name (retro font)
      ctx.fillStyle = player.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(name, px, py - 8);

      // Health bar (cyberpunk colors)
      const barW = 30;
      const barH = 3;
      const barX = px - barW / 2;
      const barY = py + 3;
      const hpFraction = player.health / 3;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = hpFraction > 0.5 ? '#39ff14' : hpFraction > 0.25 ? '#ffaa00' : '#ff00ff';
      ctx.fillRect(barX, barY, barW * hpFraction, barH);

      // Armor indicator
      if (player.armor > 0) {
        ctx.fillStyle = player.armor >= 2 ? COLORS.powerupHeavyArmor : COLORS.powerupArmor;
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.fillText(`[${player.armor}]`, px, py + 7);
      }
    }
  }
}
