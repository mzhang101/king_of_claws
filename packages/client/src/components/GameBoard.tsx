// ============================================================
// King of Claws — Game Board Component (Retro-Geek Modernism)
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@king-of-claws/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_INITIAL_HEALTH } from '@king-of-claws/shared';
import { GameRenderer } from '../renderer/canvas.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import LanguageToggle from './LanguageToggle.js';
import GameOverlay from './GameOverlay.js';

const API_BASE = '';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

interface GameBoardProps {
  roomId: string;
  onBack: () => void;
}

export default function GameBoard({ roomId, onBack }: GameBoardProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [mcpBaseUrl, setMcpBaseUrl] = useState<string>('');
  const [skillCopied, setSkillCopied] = useState(false);
  // Fetch room details
  useEffect(() => {
    fetch(`${API_BASE}/api/rooms/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.mcpBaseUrl) setMcpBaseUrl(data.mcpBaseUrl);
      })
      .catch(() => {});
  }, [roomId]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join_room', roomId }));
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'game_state') {
          setGameState(msg.state);
        }
      } catch {}
    };

    return () => ws.close();
  }, [roomId]);

  // Init canvas renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new GameRenderer(canvasRef.current);
    }
  }, []);

  // Render on state change
  useEffect(() => {
    if (gameState && rendererRef.current) {
      rendererRef.current.render(gameState);
    }
  }, [gameState]);

  const startGame = async () => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomId}/start`, { method: 'POST' });
    } catch {}
  };

  const addBot = async () => {
    try {
      await fetch(`${API_BASE}/api/rooms/${roomId}/add-bot`, { method: 'POST' });
    } catch {}
  };

  const closeRoom = async () => {
    if (!window.confirm('Close this room? All players will be disconnected.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) onBack();
    } catch {}
  };

  const copySkillLink = async () => {
    const url = `${window.location.origin}/SKILL.md`;
    try {
      await navigator.clipboard.writeText(url);
      setSkillCopied(true);
      setTimeout(() => setSkillCopied(false), 2000);
    } catch {}
  };

  const mcpUrl = mcpBaseUrl || `${window.location.origin}/mcp/${roomId}`;
  const playerCount = gameState?.players.length || 0;

  return (
    <div className="min-h-screen bg-background text-on-background font-body flex flex-col">
      {/* Top Bar - Full Width */}
      <header className="bg-surface-container-low px-6 md:px-8 py-4 border-b border-surface-container-highest">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors step-easing font-label text-[10px] uppercase tracking-[0.15em]"
            >
              <span>←</span>
              <span>{t.back}</span>
            </button>
            <span className="font-label text-[10px] text-on-surface-variant tracking-[0.3em]">
              ROOM: #{roomId.slice(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className={`font-label text-[10px] uppercase tracking-[0.15em] ${
              connected ? 'text-primary' : 'text-error'
            }`}>
              {connected ? 'ONLINE' : 'OFFLINE'}
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Layout: Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area - 70% */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-surface-dim">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border border-outline-variant/30"
              style={{ borderRadius: 0 }}
            />
            {gameState && <GameOverlay state={gameState} />}
          </div>
        </div>

        {/* Sidebar - 30% */}
        <aside className="w-80 md:w-96 bg-surface-container-low border-l border-surface-container-highest overflow-y-auto">
          <div className="p-6 md:p-8 space-y-6 md:space-y-8">
            {/* Game Info */}
            <section className="space-y-4">
              <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase border-b border-outline-variant/20 pb-2">
                {t.gameInfo}
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between items-center">
                  <dt className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.status}
                  </dt>
                  <dd className={`font-headline font-bold text-body-md uppercase tracking-wider ${
                    gameState?.status === 'playing' ? 'text-primary' :
                    gameState?.status === 'waiting' ? 'text-secondary' :
                    'text-on-surface-variant'
                  }`}>
                    {gameState?.status || t.waiting}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.tick}
                  </dt>
                  <dd className="font-headline font-bold text-body-md text-on-surface">
                    {gameState?.tick || 0}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.players}
                  </dt>
                  <dd className="font-headline font-bold text-body-md text-on-surface">
                    {playerCount}/4
                  </dd>
                </div>
              </dl>
            </section>

            {/* Players */}
            {gameState && gameState.players.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase border-b border-outline-variant/20 pb-2">
                  {t.agents}
                </h3>
                <div className="space-y-3">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className={`bg-surface-container-highest p-4 border border-outline-variant/20 ${
                        !player.alive && 'opacity-40'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3"
                            style={{ backgroundColor: player.color }}
                          />
                          <span className="font-headline font-bold text-body-md text-on-surface">
                            {player.name}
                          </span>
                        </div>
                        {!player.alive && (
                          <span className="font-label text-[10px] text-error uppercase tracking-[0.15em]">
                            {t.dead}
                          </span>
                        )}
                      </div>

                      {/* Health Bar */}
                      {player.alive && (
                        <div className="mb-3">
                          <div className="h-1 bg-surface-container-low relative">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${(player.health / PLAYER_INITIAL_HEALTH) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      {player.alive && (
                        <div className="flex gap-4 font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                          <span>B:{player.bombCount}</span>
                          <span>R:{player.bombRange}</span>
                          <span>S:{player.speed.toFixed(1)}</span>
                          {player.armor > 0 && <span className="text-secondary">A:{player.armor}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* MCP URL */}
            <section className="bg-surface-container-highest p-4 border border-primary/10">
              <h3 className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em] mb-2">
                MCP URL
              </h3>
              <input
                type="text"
                value={mcpUrl}
                readOnly
                onClick={(e) => e.currentTarget.select()}
                className="w-full bg-surface-container-low px-3 py-2 text-[10px] text-primary font-headline cursor-pointer border-b border-outline/30 focus:border-tertiary focus:outline-none"
                style={{ borderRadius: 0 }}
              />
              <button
                onClick={copySkillLink}
                className="w-full mt-2 px-3 py-2 bg-surface-container-low text-on-surface-variant hover:text-primary border border-outline-variant/30 hover:border-primary/50 font-label text-[10px] uppercase tracking-widest transition-all step-easing"
                style={{ borderRadius: 0 }}
              >
                {skillCopied ? '✓ SKILL LINK COPIED' : 'COPY SKILL LINK'}
              </button>
            </section>

            {/* Controls */}
            {gameState?.status === 'waiting' && (
              <div className="space-y-3">
                <button
                  onClick={startGame}
                  disabled={playerCount < 2}
                  className="w-full px-6 py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-body-md uppercase tracking-wider hover:shadow-[0_0_30px_rgba(142,255,113,0.3)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all step-easing"
                  style={{ borderRadius: 0 }}
                >
                  {t.startGame}
                </button>
                <button
                  onClick={addBot}
                  className="w-full px-6 py-4 bg-surface-container-highest text-on-surface hover:text-primary border border-outline-variant/30 hover:border-primary/50 font-headline font-bold text-body-sm uppercase tracking-wider transition-all step-easing"
                  style={{ borderRadius: 0 }}
                >
                  ADD BOT
                </button>
              </div>
            )}

            {/* Close Room */}
            <button
              onClick={closeRoom}
              className="w-full px-4 py-3 bg-surface-container text-error/70 hover:text-error border border-error/20 hover:border-error/50 font-label text-[10px] uppercase tracking-widest transition-all step-easing"
              style={{ borderRadius: 0 }}
            >
              CLOSE ROOM
            </button>
          </div>
        </aside>
      </div>

      {/* Agent Log - Bottom */}
      {gameState && gameState.recentActions && gameState.recentActions.length > 0 && (
        <section className="border-t border-surface-container-highest p-4 md:p-6 max-h-48 overflow-y-auto bg-surface-container-low">
          <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase mb-4">
            AGENT_LOG
          </h3>
          <div className="space-y-2">
            {gameState.recentActions.slice().reverse().map((log, idx) => (
              <div key={`${log.tick}-${idx}`} className="flex gap-4 text-body-sm border-l-2 border-primary/30 pl-3 py-1">
                <span className="text-on-surface-variant font-headline text-[10px]">[T{log.tick}]</span>
                <span className="text-primary font-headline text-[10px]">{log.playerName}</span>
                <span className="text-on-surface text-body-sm">{log.action}</span>
                {log.thought && <span className="text-on-surface-variant text-body-sm italic">"{log.thought}"</span>}
                {log.shout && <span className="text-secondary text-body-sm">💬 "{log.shout}"</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
