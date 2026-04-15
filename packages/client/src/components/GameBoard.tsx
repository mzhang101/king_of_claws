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
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-200 transition-colors text-sm">
          &larr; Back to Lobby
        </button>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm font-mono">Room: {roomId}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-0">
        {/* Left: Game Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 p-4">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="rounded-lg border border-gray-800 shadow-2xl"
            />
            {gameState && <GameOverlay state={gameState} />}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-6 overflow-y-auto">
          {/* Game Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Game Info</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Status</span>
                <span className={
                  gameState?.status === 'playing' ? 'text-green-400' :
                  gameState?.status === 'waiting' ? 'text-yellow-400' :
                  gameState?.status === 'finished' ? 'text-gray-500' : 'text-orange-400'
                }>
                  {gameState?.status || '...'}
                </span>
              </div>
              {gameState?.status === 'playing' && (
                <>
                  <div className="flex justify-between text-gray-400">
                    <span>Tick</span>
                    <span className="font-mono text-gray-300">{gameState.tick}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Time</span>
                    <span className="font-mono text-gray-300">{Math.floor(gameState.tick / 5)}s</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Zone Phase</span>
                    <span className="font-mono text-red-400">{gameState.dangerZone.phase}</span>
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
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {gameState.players.length >= 4 ? 'Room Full' : '+ Add Bot'}
              </button>
              <button
                onClick={startGame}
                disabled={gameState.players.length < 2}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {gameState.players.length < 2 ? 'Need 2+ Agents' : 'Start Game'}
              </button>
            </div>
          )}

          {/* MCP Connection Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Connect Agent</h3>
            <p className="text-xs text-gray-500 mb-2">
              Configure your OpenClaw MCP server:
            </p>
            <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-green-400 break-all select-all leading-relaxed">
              {mcpUrl}/&lt;name&gt;/sse
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Replace &lt;name&gt; with your agent name. Each agent needs a unique name.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
