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
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
        <div className="text-center">
          <p className="text-cyan-400 text-lg mb-4 font-mono" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.8rem' }}>
            &gt; INITIALIZING_BATTLE
          </p>
          <p className="text-8xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace" }}>
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
      <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
        <div className="text-center border-4 border-cyan-400 bg-black p-8 rounded-lg shadow-[0_0_30px_rgba(0,255,255,0.5)]">
          {winner ? (
            <>
              <p className="text-cyan-400 text-lg mb-4 font-mono" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.8rem' }}>
                &gt; VICTORY
              </p>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white"
                  style={{ backgroundColor: winner.color, boxShadow: `0 0 20px ${winner.color}` }}
                />
                <p className="text-4xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  {winner.name}
                </p>
              </div>
              <p className="text-5xl mb-4">&#x1f3c6;</p>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold text-gray-300 mb-2" style={{ fontFamily: "'Press Start 2P', monospace" }}>DRAW!</p>
              <p className="text-gray-500 font-mono">NO_SURVIVORS</p>
            </>
          )}
          <p className="text-purple-500 text-sm mt-4 font-mono">
            DURATION: {Math.floor(state.tick / 5)}s ({state.tick} ticks)
          </p>
        </div>
      </div>
    );
  }

  // Zone shrink warning (show when zone shrinks in < 5 seconds)
  if (state.status === 'playing' && state.dangerZone.nextShrinkInTicks <= 25) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black border-2 border-red-500 rounded px-4 py-2 text-red-400 text-sm font-mono animate-pulse shadow-[0_0_15px_rgba(255,0,100,0.5)]">
          &#x26a0; ZONE_SHRINK: {Math.ceil(state.dangerZone.nextShrinkInTicks / 5)}s
        </div>
      </div>
    );
  }

  return null;
}
