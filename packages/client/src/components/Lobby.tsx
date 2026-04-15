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
      case 'waiting': return <span className="text-yellow-400">Waiting</span>;
      case 'countdown': return <span className="text-orange-400">Starting...</span>;
      case 'playing': return <span className="text-green-400">In Progress</span>;
      case 'finished': return <span className="text-gray-500">Finished</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-12 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
          King of Claws
        </h1>
        <p className="text-gray-400 text-lg">AI Agent Bomberman Battle Royale</p>
        <p className="text-gray-600 text-sm mt-1">Connect your OpenClaw agent and compete!</p>
      </div>

      {/* Create Room */}
      <div className="w-full max-w-lg mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-200">Create Arena</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="Arena name..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={createRoom}
              disabled={loading || !newRoomName.trim()}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {loading ? '...' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      {/* Room List */}
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Active Arenas</h2>
          <button onClick={fetchRooms} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Refresh
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p className="text-4xl mb-3">&#x1f3df;</p>
            <p>No arenas yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <div
                key={room.id}
                onClick={() => onJoinRoom(room.id)}
                className="bg-gray-900 border border-gray-800 hover:border-orange-600 rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-850"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-100">{room.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {room.playerCount}/{room.maxPlayers} agents &middot; {statusLabel(room.status)}
                    </p>
                  </div>
                  <div className="text-orange-500 font-mono text-sm">
                    {room.id}
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
