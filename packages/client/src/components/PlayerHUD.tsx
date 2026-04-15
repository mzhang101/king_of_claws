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
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Players</h3>
      {players.map(player => (
        <div
          key={player.id}
          className={`bg-gray-900 border rounded-lg p-3 transition-all ${
            player.alive
              ? 'border-gray-700'
              : 'border-gray-800 opacity-50'
          }`}
        >
          {/* Name & Status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border-2 border-white/30"
                style={{ backgroundColor: player.color }}
              />
              <span className={`font-semibold text-sm ${player.alive ? 'text-gray-100' : 'text-gray-500 line-through'}`}>
                {player.name}
              </span>
            </div>
            {!player.alive && (
              <span className="text-xs text-red-500 font-mono">ELIMINATED</span>
            )}
            {player.alive && !player.connected && (
              <span className="text-xs text-yellow-500 font-mono">DISCONNECTED</span>
            )}
          </div>

          {/* Health Bar */}
          {player.alive && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 w-6">HP</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(player.health / 3) * 100}%`,
                      backgroundColor: player.health > 1 ? '#44ff44' : player.health > 0.5 ? '#ffaa00' : '#ff4444',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono w-5 text-right">{player.health}</span>
              </div>

              {/* Stats */}
              <div className="flex gap-3 text-xs text-gray-500">
                <span title="Bomb Count">&#x1f4a3; {player.bombCount}</span>
                <span title="Bomb Range">&#x1f4a5; {player.bombRange}</span>
                <span title="Speed">&#x26a1; {player.speed}</span>
                <span className="text-gray-600 ml-auto font-mono">
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
