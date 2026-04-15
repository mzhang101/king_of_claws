// ============================================================
// King of Claws — Game Overlay (Countdown, Winner, Zone Warning)
// ============================================================

import type { GameState } from '@king-of-claws/shared';

interface GameOverlayProps {
  state: GameState;
}

export default function GameOverlay({ state }: GameOverlayProps) {
  // Countdown overlay
  if (state.status === 'countdown' && state.countdownRemaining !== null) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">Game starting in</p>
          <p className="text-8xl font-bold text-orange-400 animate-pulse">
            {state.countdownRemaining}
          </p>
        </div>
      </div>
    );
  }

  // Winner overlay
  if (state.status === 'finished') {
    const winner = state.players.find(p => p.id === state.winner);
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
        <div className="text-center">
          {winner ? (
            <>
              <p className="text-gray-400 text-lg mb-2">Winner!</p>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white"
                  style={{ backgroundColor: winner.color }}
                />
                <p className="text-4xl font-bold text-white">{winner.name}</p>
              </div>
              <p className="text-5xl mb-4">&#x1f3c6;</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-300 mb-2">Draw!</p>
              <p className="text-gray-500">No survivors</p>
            </>
          )}
          <p className="text-gray-600 text-sm mt-4">
            Match lasted {Math.floor(state.tick / 5)} seconds ({state.tick} ticks)
          </p>
        </div>
      </div>
    );
  }

  // Zone shrink warning (show when zone shrinks in < 5 seconds)
  if (state.status === 'playing' && state.dangerZone.nextShrinkInTicks <= 25) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-red-900/80 border border-red-600 rounded-lg px-4 py-2 text-red-200 text-sm font-mono animate-pulse">
          &#x26a0; Zone shrinking in {Math.ceil(state.dangerZone.nextShrinkInTicks / 5)}s
        </div>
      </div>
    );
  }

  return null;
}
