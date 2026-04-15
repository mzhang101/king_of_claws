// ============================================================
// King of Claws — Game Overlay (Retro-Geek Modernism)
// ============================================================

import type { GameState } from '@king-of-claws/shared';

interface GameOverlayProps {
  state: GameState;
}

export default function GameOverlay({ state }: GameOverlayProps) {
  // Countdown overlay
  if (state.status === 'countdown' && state.countdownRemaining !== null) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-10">
        <div className="text-center border-4 border-primary bg-surface-container-low p-12 relative">
          {/* Neon Glow */}
          <div className="absolute -inset-2 bg-primary opacity-20 blur-2xl"></div>

          <div className="relative">
            <p className="font-label text-[10px] text-on-surface-variant mb-8 tracking-[0.3em] uppercase">
              INITIALIZING_BATTLE
            </p>
            <p className="text-8xl font-black text-primary animate-pulse font-headline">
              {state.countdownRemaining}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Winner overlay
  if (state.status === 'finished') {
    const winner = state.players.find(p => p.id === state.winner);
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-10">
        <div className="text-center border-4 border-primary bg-surface-container-low p-12 relative">
          {/* Neon Glow */}
          <div className="absolute -inset-2 bg-primary opacity-30 blur-2xl"></div>

          <div className="relative">
            {winner ? (
              <>
                <p className="font-label text-[10px] text-on-surface-variant mb-8 tracking-[0.3em] uppercase">
                  VICTORY
                </p>
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div
                    className="w-8 h-8 border-4"
                    style={{
                      backgroundColor: winner.color,
                      borderColor: winner.color,
                    }}
                  />
                  <p className="text-5xl font-black text-primary font-headline">
                    {winner.name}
                  </p>
                </div>
                <p className="text-6xl mb-6">🏆</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black text-on-surface-variant mb-4 font-headline">DRAW!</p>
                <p className="text-on-surface-variant text-body-lg uppercase tracking-wider font-label">
                  NO SURVIVORS
                </p>
              </>
            )}
            <p className="text-on-surface text-body-md mt-6 font-body">
              DURATION: {Math.floor(state.tick / 5)}s ({state.tick} ticks)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Zone shrink warning
  if (state.status === 'playing' && state.dangerZone.nextShrinkInTicks <= 25) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-surface-container-low border-2 border-error px-6 py-3 text-error text-body-md animate-pulse font-label uppercase tracking-[0.15em]">
          ⚠ ZONE_SHRINK: {Math.ceil(state.dangerZone.nextShrinkInTicks / 5)}s
        </div>
      </div>
    );
  }

  return null;
}
