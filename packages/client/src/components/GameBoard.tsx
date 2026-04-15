// ============================================================
// King of Claws — Game Board Component (Canvas + HUD)
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@king-of-claws/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@king-of-claws/shared';
import { GameRenderer } from '../renderer/canvas.js';
import PlayerHUD from './PlayerHUD.js';
import GameOverlay from './GameOverlay.js';

// Use relative URLs — works with Vite proxy (dev) and Nginx reverse proxy (prod)
const API_BASE = '';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

interface GameBoardProps {
  roomId: string;
  onBack: () => void;
}

export default function GameBoard({ roomId, onBack }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [mcpBaseUrl, setMcpBaseUrl] = useState<string>('');

  // Fetch room details (including MCP URL) from server
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

  // MCP URL from server (uses PUBLIC_URL env var when deployed)
  const mcpUrl = mcpBaseUrl || `${window.location.origin}/mcp/${roomId}`;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b-2 border-cyan-500">
        <button onClick={onBack} className="text-cyan-400 hover:text-pink-400 transition-colors text-sm font-mono">
          &lt; BACK_TO_LOBBY
        </button>
        <div className="flex items-center gap-4">
          <span className="text-purple-500 text-sm font-mono">ROOM: #{roomId.slice(0, 8)}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-mono border ${connected ? 'bg-green-900 text-green-400 border-green-500' : 'bg-red-900 text-red-400 border-red-500'}`}>
            {connected ? '[ONLINE]' : '[OFFLINE]'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-0">
        {/* Left: Game Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-black to-purple-950 p-4 gap-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="rounded border-4 border-cyan-500 shadow-[0_0_30px_rgba(0,255,255,0.4)]"
            />
            {gameState && <GameOverlay state={gameState} />}
          </div>

          {/* Agent Thoughts Display */}
          {gameState && gameState.recentActions && gameState.recentActions.length > 0 && (
            <div className="w-full max-w-3xl bg-black border-2 border-purple-600 rounded p-4 max-h-48 overflow-y-auto">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 font-mono">&gt; AGENT_THOUGHTS</h3>
              <div className="space-y-2">
                {gameState.recentActions.slice().reverse().map((log, idx) => (
                  <div key={`${log.tick}-${log.playerId}-${idx}`} className="border-l-2 border-purple-500 pl-3 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-cyan-400 font-mono text-xs">[T{log.tick}]</span>
                      <span className="text-pink-400 font-mono text-xs font-bold">{log.playerName}</span>
                      <span className="text-gray-500 font-mono text-xs">&gt; {log.action}</span>
                    </div>
                    {log.thought && (
                      <p className="text-purple-300 text-xs font-mono leading-relaxed mb-1">
                        💭 {log.thought}
                      </p>
                    )}
                    {log.shout && (
                      <p className="text-yellow-400 text-xs font-mono italic">
                        💬 "{log.shout}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="w-72 bg-black border-l-2 border-purple-600 p-4 flex flex-col gap-6 overflow-y-auto">
          {/* Game Info */}
          <div className="border-2 border-cyan-500 rounded p-3 bg-gray-950">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 font-mono">&gt; SYSTEM_INFO</h3>
            <div className="space-y-1 text-sm font-mono">
              <div className="flex justify-between text-purple-400">
                <span>STATUS</span>
                <span className={
                  gameState?.status === 'playing' ? 'text-green-400' :
                  gameState?.status === 'waiting' ? 'text-yellow-400' :
                  gameState?.status === 'finished' ? 'text-gray-500' : 'text-orange-400'
                }>
                  [{gameState?.status?.toUpperCase() || '...'}]
                </span>
              </div>
              {gameState?.status === 'playing' && (
                <>
                  <div className="flex justify-between text-purple-400">
                    <span>TICK</span>
                    <span className="text-cyan-400">{gameState.tick}</span>
                  </div>
                  <div className="flex justify-between text-purple-400">
                    <span>TIME</span>
                    <span className="text-cyan-400">{Math.floor(gameState.tick / 5)}s</span>
                  </div>
                  <div className="flex justify-between text-purple-400">
                    <span>ZONE</span>
                    <span className="text-red-400">PHASE_{gameState.dangerZone.phase}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Players */}
          {gameState && <PlayerHUD players={gameState.players} />}

          {/* Controls */}
          {gameState?.status === 'waiting' && (
            <div className="space-y-2">
              <button
                onClick={addBot}
                disabled={gameState.players.length >= 4}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white font-semibold py-2.5 rounded transition-all border-2 border-cyan-400 disabled:border-gray-700"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.6rem' }}
              >
                {gameState.players.length >= 4 ? 'ROOM_FULL' : '+ ADD_BOT'}
              </button>
              <button
                onClick={startGame}
                disabled={gameState.players.length < 2}
                className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white font-semibold py-2.5 rounded transition-all border-2 border-pink-400 disabled:border-gray-700"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.6rem' }}
              >
                {gameState.players.length < 2 ? 'NEED_2+_AGENTS' : 'START_GAME'}
              </button>
            </div>
          )}

          {/* MCP Connection Info */}
          <div className="border-2 border-purple-500 rounded p-3 bg-gray-950">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3 font-mono">&gt; CONNECT_AGENT</h3>
            <p className="text-xs text-purple-400 mb-2 font-mono">
              Configure OpenClaw MCP:
            </p>
            <div className="bg-black border border-green-500 rounded p-3 text-xs font-mono text-green-400 break-all select-all leading-relaxed">
              {mcpUrl}
            </div>
            <p className="text-xs text-gray-600 mt-2 font-mono">
              Auto-assigns player ID and name
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
