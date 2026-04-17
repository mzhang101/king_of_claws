// ============================================================
// King of Claws — Player Personal Page (Retro-Geek Modernism)
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { GameState } from '@king-of-claws/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_INITIAL_HEALTH } from '@king-of-claws/shared';
import { GameRenderer } from '../renderer/canvas.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import LanguageToggle from './LanguageToggle.js';
import GameOverlay from './GameOverlay.js';

const API_BASE = '';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

interface PlayerInfo {
  playerId: string;
  credits: number;
  agent: {
    id: string;
    name: string;
    alive: boolean;
    health: number;
    x: number;
    y: number;
  };
  room: {
    id: string;
    name: string;
    status: string;
  };
  airdrop: {
    cost: number;
    onCooldown: boolean;
    cooldownSeconds: number;
  };
}

function formatRelativeTime(timestamp: number | null, now: number): string {
  if (!timestamp) return 'never';
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSeconds < 1) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  return `${diffMinutes}m ago`;
}

function getStrategicStatus(
  strategicAttached: boolean,
  lastStrategicAt: number | null,
  now: number,
): { label: string; className: string } {
  if (!strategicAttached) {
    return {
      label: 'NOT ATTACHED',
      className: 'border-outline-variant/30 text-on-surface-variant bg-surface-container-highest',
    };
  }

  if (!lastStrategicAt) {
    return {
      label: 'CONNECTED',
      className: 'border-secondary/30 text-secondary bg-secondary/10',
    };
  }

  if (now - lastStrategicAt <= 5000) {
    return {
      label: 'THINKING',
      className: 'border-primary/30 text-primary bg-primary/10',
    };
  }

  return {
    label: 'IDLE',
    className: 'border-tertiary/30 text-tertiary bg-tertiary/10',
  };
}

function getTacticalStatus(usingFallback: boolean, tacticalRegistered: boolean): { label: string; className: string } {
  if (!tacticalRegistered) {
    return {
      label: 'OFFLINE',
      className: 'border-outline-variant/30 text-on-surface-variant bg-surface-container-highest',
    };
  }

  if (usingFallback) {
    return {
      label: 'RULE FALLBACK',
      className: 'border-error/30 text-error bg-error/10',
    };
  }

  return {
    label: 'GEMINI LIVE',
    className: 'border-primary/30 text-primary bg-primary/10',
  };
}

export default function PlayerPage() {
  const { t } = useLanguage();
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [airdropMessage, setAirdropMessage] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch player info
  useEffect(() => {
    if (!token) return;

    const fetchPlayerInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/player/${token}`);
        if (!res.ok) {
          setError('Player account not found');
          return;
        }
        const data = await res.json();
        setPlayerInfo(data);
      } catch (err) {
        setError('Failed to load player info');
      }
    };

    fetchPlayerInfo();
    const interval = setInterval(fetchPlayerInfo, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // WebSocket connection for game state
  useEffect(() => {
    if (!playerInfo) return;

    const roomId = playerInfo.room.id;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setWsConnected(true);
        setUsingFallback(false);
        ws?.send(JSON.stringify({ type: 'join_room', roomId }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'game_state') {
            setGameState(msg.state);
            setUsingFallback(false);
          }
        } catch (err) {
          console.warn('[PlayerPage] Failed to parse WS message', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[PlayerPage] WebSocket error', err);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!isCancelled) {
          reconnectTimer = setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      isCancelled = true;
      setWsConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [playerInfo?.room.id]);

  // REST fallback: keep board visible even if WS first frame is missed.
  useEffect(() => {
    if (!token) return;

    const fetchBoard = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/player/${token}/board`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.state) {
          setGameState(data.state);
          if (!wsConnected) {
            setUsingFallback(true);
          }
        }
      } catch {
        // Fallback polling errors are non-fatal.
      }
    };

    fetchBoard();
    const interval = setInterval(fetchBoard, 1000);
    return () => clearInterval(interval);
  }, [token, wsConnected]);

  // Init canvas renderer (canvas only in DOM after playerInfo loads)
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new GameRenderer(canvasRef.current);
    }
  }, [playerInfo]);

  // Render on state change
  useEffect(() => {
    if (gameState && rendererRef.current) {
      rendererRef.current.render(gameState);
    }
  }, [gameState]);

  const callAirdrop = async () => {
    if (!token || !playerInfo) return;

    setAirdropLoading(true);
    setAirdropMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/player/${token}/airdrop`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setAirdropMessage(`❌ ${data.error}`);
      } else {
        setAirdropMessage(`✅ Airdrop called! Landing in 3 ticks...`);
        // Refresh player info
        const infoRes = await fetch(`${API_BASE}/api/player/${token}`);
        if (infoRes.ok) {
          setPlayerInfo(await infoRes.json());
        }
      }
    } catch (err) {
      setAirdropMessage('❌ Failed to call airdrop');
    } finally {
      setAirdropLoading(false);
      setTimeout(() => setAirdropMessage(null), 5000);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center border-4 border-error bg-surface-container-low p-12">
          <p className="text-error text-2xl mb-4 font-headline font-bold uppercase">
            {t.error}
          </p>
          <p className="text-on-surface-variant text-body-lg">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!playerInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-2xl animate-pulse font-headline font-bold uppercase">
          {t.loading}...
        </div>
      </div>
    );
  }

  const myTelemetry = gameState?.aiTelemetry?.find(entry => entry.playerId === playerInfo.agent.id) ?? null;
  const myActions = gameState?.recentActions?.filter(log => log.playerId === playerInfo.agent.id) ?? [];
  const latestAction = myActions[myActions.length - 1];
  const strategicStatus = getStrategicStatus(myTelemetry?.strategicAttached ?? false, myTelemetry?.lastStrategicAt ?? null, now);
  const tacticalStatus = getTacticalStatus(myTelemetry?.usingFallback ?? true, myTelemetry?.tacticalRegistered ?? false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar - Full Width */}
      <header className="bg-surface-container-low px-6 md:px-8 py-4 border-b border-surface-container-highest">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <h1 className="font-headline font-black text-xl md:text-2xl tracking-tighter text-primary">
              {playerInfo.agent.name}
            </h1>
            <span className={`px-2 py-1 border font-label text-[10px] uppercase tracking-[0.15em] ${
              playerInfo.agent.alive
                ? 'border-primary/30 text-primary bg-primary/10'
                : 'border-error/30 text-error bg-error/10'
            }`}>
              {playerInfo.agent.alive ? t.alive : t.dead}
            </span>
            <span className={`px-2 py-1 border font-label text-[10px] uppercase tracking-[0.15em] ${
              wsConnected
                ? 'border-primary/30 text-primary bg-primary/10'
                : 'border-error/30 text-error bg-error/10'
            }`}>
              {wsConnected ? 'WS LIVE' : (usingFallback ? 'REST FALLBACK' : 'WS RETRY')}
            </span>
            <span className="px-2 py-1 border border-secondary/30 text-secondary bg-secondary/10 font-label text-[10px] uppercase tracking-[0.15em]">
              1S TICK
            </span>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            {/* Credits Display - Large */}
            <div className="flex items-center gap-3">
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                {t.credits}
              </span>
              <span className="font-headline font-black text-3xl md:text-4xl text-primary tracking-tighter">
                {playerInfo.credits}
              </span>
            </div>

            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Layout: Canvas + Control Panel */}
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

        {/* Control Panel - 30% */}
        <aside className="w-80 md:w-96 bg-surface-container-low border-l border-surface-container-highest overflow-y-auto">
          <div className="p-6 md:p-8 space-y-6 md:space-y-8">
            {/* Agent Status */}
            <section className="space-y-4">
              <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase border-b border-outline-variant/20 pb-2">
                {t.agentStatus}
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between items-center">
                  <dt className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.health}
                  </dt>
                  <dd className={`font-headline font-bold text-body-md ${
                    playerInfo.agent.health > 1 ? 'text-primary' : 'text-error'
                  }`}>
                    {playerInfo.agent.health}/{PLAYER_INITIAL_HEALTH}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.position}
                  </dt>
                  <dd className="font-headline font-bold text-body-md text-on-surface">
                    ({playerInfo.agent.x}, {playerInfo.agent.y})
                  </dd>
                </div>
              </dl>
            </section>

            <section className="space-y-4">
              <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase border-b border-outline-variant/20 pb-2">
                AI Pipeline
              </h3>

              <div className="space-y-3">
                <div className="bg-surface-container-highest p-4 border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      OpenClaw Strategic Layer
                    </span>
                    <span className={`px-2 py-0.5 border font-label text-[9px] uppercase tracking-[0.15em] ${strategicStatus.className}`}>
                      {strategicStatus.label}
                    </span>
                  </div>

                  <div className="space-y-2 text-body-sm text-on-surface">
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Controller</span>
                      <span className="font-headline font-bold uppercase">{myTelemetry?.source === 'mcp' ? 'OPENCLAW' : 'BOT'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Last activity</span>
                      <span>{formatRelativeTime(myTelemetry?.lastStrategicAt ?? null, now)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Strategic calls</span>
                      <span>{myTelemetry?.strategicCallCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Last tool</span>
                      <span className="font-mono text-[11px]">{myTelemetry?.lastStrategicTool ?? 'none'}</span>
                    </div>
                  </div>

                  {myTelemetry?.lastStrategicSummary && (
                    <p className="text-body-sm text-secondary leading-relaxed">
                      {myTelemetry.lastStrategicSummary}
                    </p>
                  )}
                  {myTelemetry?.lastDirective && (
                    <p className="text-body-sm text-on-surface-variant leading-relaxed">
                      Directive: {myTelemetry.lastDirective}
                    </p>
                  )}
                </div>

                <div className="bg-surface-container-highest p-4 border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                      Tactical Brain
                    </span>
                    <span className={`px-2 py-0.5 border font-label text-[9px] uppercase tracking-[0.15em] ${tacticalStatus.className}`}>
                      {tacticalStatus.label}
                    </span>
                  </div>

                  <div className="space-y-2 text-body-sm text-on-surface">
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Last decision</span>
                      <span>{myTelemetry?.lastDecisionAction ?? 'none'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Decision tick</span>
                      <span>{myTelemetry?.lastDecisionTick ?? '-'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Latency</span>
                      <span>{myTelemetry?.lastDecisionLatencyMs != null ? `${myTelemetry.lastDecisionLatencyMs}ms` : '-'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-on-surface-variant">Last tactical activity</span>
                      <span>{formatRelativeTime(myTelemetry?.lastDecisionAt ?? null, now)}</span>
                    </div>
                  </div>

                  {myTelemetry?.lastDecisionReasoning && (
                    <p className="text-body-sm text-primary leading-relaxed">
                      {myTelemetry.lastDecisionReasoning}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Airdrop Control */}
            <section className="space-y-4">
              <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase border-b border-outline-variant/20 pb-2">
                {t.airdrop}
              </h3>

              {/* Cost Info */}
              <div className="bg-surface-container-highest p-4 border border-outline-variant/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em]">
                    {t.cost}
                  </span>
                  <span className="font-headline font-bold text-body-md text-on-surface">
                    {playerInfo.airdrop.cost}
                  </span>
                </div>
                {playerInfo.airdrop.onCooldown && (
                  <div className="font-label text-[10px] text-secondary uppercase tracking-[0.15em]">
                    {t.cooldown}: {playerInfo.airdrop.cooldownSeconds}s
                  </div>
                )}
              </div>

              {/* Airdrop Button */}
              <button
                onClick={callAirdrop}
                disabled={
                  airdropLoading ||
                  !playerInfo.agent.alive ||
                  playerInfo.room.status !== 'playing' ||
                  playerInfo.credits < playerInfo.airdrop.cost ||
                  playerInfo.airdrop.onCooldown
                }
                className="w-full px-6 py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-body-md uppercase tracking-wider hover:shadow-[0_0_30px_rgba(142,255,113,0.3)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all step-easing"
                style={{ borderRadius: 0 }}
              >
                {airdropLoading ? t.loading : t.callAirdrop}
              </button>

              {airdropMessage && (
                <div className="text-center text-body-sm p-3 border border-primary/30 bg-primary/10 text-on-surface">
                  {airdropMessage}
                </div>
              )}

              <p className="text-body-sm text-on-surface-variant text-center">
                Drops premium item at agent's current position after 3 ticks
              </p>
            </section>

            {/* Room Info */}
            <section className="bg-surface-container-highest p-4 border border-outline-variant/20">
              <h3 className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.15em] mb-3">
                {t.room}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-body-sm text-on-surface-variant">{t.name}</span>
                  <span className="text-body-sm text-primary font-headline font-bold">
                    {playerInfo.room.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-body-sm text-on-surface-variant">{t.status}</span>
                  <span className={`text-body-sm font-headline font-bold uppercase ${
                    playerInfo.room.status === 'playing' ? 'text-primary' :
                    playerInfo.room.status === 'waiting' ? 'text-secondary' :
                    'text-on-surface-variant'
                  }`}>
                    {playerInfo.room.status}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>

      {gameState && (
        <section className="border-t border-surface-container-highest p-4 md:p-6 max-h-80 overflow-y-auto bg-surface-container-low space-y-6">
          {myTelemetry && myTelemetry.recentEvents.length > 0 && (
            <div>
              <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase mb-4">
                AI Timeline
              </h3>
              <div className="space-y-2">
                {myTelemetry.recentEvents.slice().reverse().map(event => (
                  <div key={event.id} className="border-l-2 border-secondary/30 pl-3 py-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-on-surface-variant font-headline text-[10px]">[T{event.tick}]</span>
                      <span className={`px-2 py-0.5 border font-label text-[9px] uppercase tracking-[0.15em] ${
                        event.layer === 'strategic'
                          ? 'border-secondary/30 text-secondary bg-secondary/10'
                          : event.layer === 'tactical'
                            ? 'border-primary/30 text-primary bg-primary/10'
                            : 'border-outline-variant/30 text-on-surface-variant bg-surface-container-highest'
                      }`}>
                        {event.layer}
                      </span>
                      <span className="text-on-surface text-body-sm font-medium">{event.summary}</span>
                      <span className="text-on-surface-variant text-[11px] ml-auto">{formatRelativeTime(event.timestamp, now)}</span>
                    </div>
                    {event.detail && (
                      <p className="text-on-surface-variant text-body-sm leading-relaxed">
                        {event.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {myActions.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-headline font-bold text-lg tracking-tight text-on-surface uppercase">
                  Tactical Trace
                </h3>
                {latestAction?.strategyMode && (
                  <span className="px-2 py-0.5 border border-primary/40 text-primary bg-primary/10 font-label text-[9px] uppercase tracking-[0.15em]">
                    {latestAction.strategyMode}
                  </span>
                )}
                {latestAction?.wasFallback && (
                  <span className="px-2 py-0.5 border border-error/30 font-label text-[9px] uppercase tracking-[0.15em] text-error bg-error/5">
                    FALLBACK
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {myActions.slice().reverse().map((log, idx) => (
                  <div key={`${log.tick}-${idx}`} className="border-l-2 border-primary/30 pl-3 py-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant font-headline text-[10px]">[T{log.tick}]</span>
                      <span className="text-on-surface text-body-sm font-medium">{log.action}</span>
                      {log.strategyMode && (
                        <span className="text-on-surface-variant font-headline text-[9px] uppercase opacity-60">
                          {log.strategyMode}
                        </span>
                      )}
                      {log.wasFallback && (
                        <span className="text-error font-headline text-[9px] uppercase">
                          RULE
                        </span>
                      )}
                    </div>
                    {log.aiReasoning && (
                      <p className="text-primary text-body-sm leading-relaxed">
                        🤖 {log.aiReasoning}
                      </p>
                    )}
                    {log.thought && !log.aiReasoning && (
                      <p className="text-primary text-body-sm leading-relaxed">
                        💭 {log.thought}
                      </p>
                    )}
                    {log.shout && (
                      <p className="text-secondary text-body-sm italic">
                        💬 "{log.shout}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
