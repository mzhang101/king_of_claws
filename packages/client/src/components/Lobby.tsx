// ============================================================
// King of Claws — Lobby Component
// ============================================================

import { useEffect, useState } from 'react';
import type { RoomSummary } from '@king-of-claws/shared';

// Use relative URLs — works with Vite proxy (dev) and Nginx reverse proxy (prod)
const API_BASE = '';

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
}

export default function Lobby({ onJoinRoom }: LobbyProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      const data = await res.json();
      setRooms(data);
    } catch {}
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });
      const data = await res.json();
      setNewRoomName('');
      onJoinRoom(data.id);
    } catch {} finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'waiting': return <span className="text-yellow-400 font-mono">[WAITING]</span>;
      case 'countdown': return <span className="text-orange-400 font-mono">[STARTING]</span>;
      case 'playing': return <span className="text-green-400 font-mono">[LIVE]</span>;
      case 'finished': return <span className="text-gray-500 font-mono">[ENDED]</span>;
      default: return <span className="font-mono">[{status}]</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-12 px-4 bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(0,255,255,0.5)]" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '2.5rem', lineHeight: '1.4' }}>
          KING OF CLAWS
        </h1>
        <p className="text-cyan-400 text-lg mt-4" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.7rem' }}>
          AI AGENT BATTLE ROYALE
        </p>
        <p className="text-purple-500 text-sm mt-3" style={{ fontFamily: "'Courier New', monospace" }}>
          &gt; Connect your OpenClaw agent and compete!
        </p>
      </div>

      {/* Create Room */}
      <div className="w-full max-w-lg mb-8">
        <div className="bg-black border-2 border-cyan-500 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
          <h2 className="text-lg font-semibold mb-4 text-cyan-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.8rem' }}>
            &gt; CREATE_ARENA
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="arena_name..."
              className="flex-1 bg-gray-900 border-2 border-purple-500 rounded px-4 py-2.5 text-cyan-400 placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors font-mono"
            />
            <button
              onClick={createRoom}
              disabled={loading || !newRoomName.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white font-semibold px-6 py-2.5 rounded transition-all border-2 border-purple-400 disabled:border-gray-700"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.6rem' }}
            >
              {loading ? '...' : 'CREATE'}
            </button>
          </div>
        </div>
      </div>

      {/* Room List */}
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cyan-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.8rem' }}>
            &gt; ACTIVE_ARENAS
          </h2>
          <button onClick={fetchRooms} className="text-sm text-purple-500 hover:text-pink-400 transition-colors font-mono">
            [REFRESH]
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-600 border-2 border-gray-800 rounded-lg bg-black">
            <p className="text-4xl mb-3">&#x1f3df;</p>
            <p className="font-mono">No arenas yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <div
                key={room.id}
                onClick={() => onJoinRoom(room.id)}
                className="bg-black border-2 border-purple-600 hover:border-cyan-400 rounded-lg p-4 cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-cyan-400 font-mono">{room.name}</h3>
                    <p className="text-sm text-purple-400 mt-0.5 font-mono">
                      {room.playerCount}/{room.maxPlayers} agents &middot; {statusLabel(room.status)}
                    </p>
                  </div>
                  <div className="text-pink-500 font-mono text-xs">
                    #{room.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
