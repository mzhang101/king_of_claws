// ============================================================
// King of Claws — Player HUD Sidebar
// ============================================================

import type { Player } from '@king-of-claws/shared';

interface PlayerHUDProps {
  players: Player[];
}

export default function PlayerHUD({ players }: PlayerHUDProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider font-mono">&gt; AGENTS</h3>
      {players.map(player => (
        <div
          key={player.id}
          className={`bg-black border-2 rounded p-3 transition-all ${
            player.alive
              ? 'border-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
              : 'border-gray-800 opacity-50'
          }`}
        >
          {/* Name & Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white/50"
                style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
              />
              <span className={`font-semibold text-sm font-mono ${player.alive ? 'text-cyan-400' : 'text-gray-600 line-through'}`}>
                {player.name}
              </span>
            </div>
            {!player.alive && (
              <span className="text-xs text-red-500 font-mono">[DEAD]</span>
            )}
            {player.alive && !player.connected && (
              <span className="text-xs text-yellow-500 font-mono">[DC]</span>
            )}
          </div>

          {/* Health Bar */}
          {player.alive && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-purple-400 w-6 font-mono">HP</span>
                <div className="flex-1 h-2 bg-gray-900 rounded overflow-hidden border border-gray-700">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(player.health / 3) * 100}%`,
                      backgroundColor: player.health > 1 ? '#39ff14' : player.health > 0.5 ? '#ffaa00' : '#ff00ff',
                    }}
                  />
                </div>
                <span className="text-xs text-cyan-400 font-mono w-5 text-right">{player.health}</span>
              </div>

              {/* Stats */}
              <div className="flex gap-3 text-xs text-purple-400 font-mono">
                <span title="Bomb Count">B:{player.bombCount}</span>
                <span title="Bomb Range">R:{player.bombRange}</span>
                <span title="Speed">S:{player.speed}</span>
                {player.armor > 0 && (
                  <span className="text-yellow-400" title="Armor">A:{player.armor}</span>
                )}
                {player.speedBoostTicks > 0 && (
                  <span className="text-green-400" title="Speed Boost">+S</span>
                )}
                {player.crossBombActive && (
                  <span className="text-pink-400" title="Cross Bomb">X</span>
                )}
                <span className="text-gray-600 ml-auto">
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
