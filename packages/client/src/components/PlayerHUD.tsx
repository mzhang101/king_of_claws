// ============================================================
// King of Claws — Player HUD Sidebar
// ============================================================

import type { Player } from '@king-of-claws/shared';
import { PLAYER_INITIAL_HEALTH } from '@king-of-claws/shared';

interface PlayerHUDProps {
  players: Player[];
}

export default function PlayerHUD({ players }: PlayerHUDProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-cyan-bright uppercase tracking-wider mb-3" style={{ fontFamily: 'Press Start 2P, monospace' }}>
        &gt; AGENTS
      </h3>
      {players.map(player => (
        <div
          key={player.id}
          className={`bg-terminal-void border-2 p-3 transition-all ${
            player.alive
              ? 'border-cyan-bright shadow-[0_0_15px_rgba(0,255,255,0.4)]'
              : 'border-gray-dim opacity-40'
          }`}
        >
          {/* Name & Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 border-2"
                style={{
                  backgroundColor: player.color,
                  borderColor: player.color,
                  boxShadow: `0 0 10px ${player.color}`
                }}
              />
              <span
                className={`text-sm ${player.alive ? 'text-cyan-bright' : 'text-gray-terminal line-through'}`}
                style={{ fontFamily: 'VT323, monospace', fontSize: '1rem' }}
              >
                {player.name}
              </span>
            </div>
            {!player.alive && (
              <span className="text-xs text-status-danger border border-status-danger px-1" style={{ fontFamily: 'Press Start 2P, monospace' }}>
                [X]
              </span>
            )}
            {player.alive && !player.connected && (
              <span className="text-xs text-status-warning border border-status-warning px-1" style={{ fontFamily: 'Press Start 2P, monospace' }}>
                [DC]
              </span>
            )}
          </div>

          {/* Health Bar */}
          {player.alive && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-purple-bright w-6" style={{ fontFamily: 'VT323, monospace' }}>HP</span>
                <div className="flex-1 h-2 bg-terminal-black border border-cyan-bright overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(player.health / PLAYER_INITIAL_HEALTH) * 100}%`,
                      backgroundColor: player.health > 1 ? '#00FF00' : player.health > 0.5 ? '#FFFF00' : '#FF0000',
                      boxShadow: player.health > 1 ? '0 0 10px #00FF00' : player.health > 0.5 ? '0 0 10px #FFFF00' : '0 0 10px #FF0000',
                    }}
                  />
                </div>
                <span className="text-xs text-cyan-bright w-5 text-right" style={{ fontFamily: 'VT323, monospace' }}>{player.health}</span>
              </div>

              {/* Stats */}
              <div className="flex gap-3 text-xs text-purple-bright" style={{ fontFamily: 'VT323, monospace', fontSize: '0.875rem' }}>
                <span title="Bomb Count">B:{player.bombCount}</span>
                <span title="Bomb Range">R:{player.bombRange}</span>
                <span title="Speed">S:{player.speed}</span>
                {player.armor > 0 && (
                  <span className="text-status-warning" title="Armor">A:{player.armor}</span>
                )}
                {player.speedBoostTicks > 0 && (
                  <span className="text-status-online" title="Speed Boost">+S</span>
                )}
                {player.crossBombActive && (
                  <span className="text-magenta-bright" title="Cross Bomb">X</span>
                )}
                <span className="text-gray-terminal ml-auto">
                  ({player.x},{player.y})
                </span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
