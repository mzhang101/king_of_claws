import { useEffect, useState } from 'react';
import type { RoomSummary } from '@king-of-claws/shared';
import { useLanguage } from '../contexts/LanguageContext.js';
import LanguageToggle from './LanguageToggle.js';

const API_BASE = '';

interface LobbyProps {
  onJoinRoom: (roomId: string) => void;
}

export default function Lobby({ onJoinRoom }: LobbyProps) {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      const data = await res.json();
      // Filter out finished rooms on client side as backup
      setRooms(data.filter((r: RoomSummary) => r.status !== 'finished'));
    } catch {}
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      setShowCreateRoom(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });
      const data = await res.json();
      setNewRoomName('');
      setShowCreateRoom(false);
      onJoinRoom(data.id);
    } catch {} finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'playing') return 'text-primary border-primary';
    if (status === 'waiting') return 'text-secondary border-secondary';
    return 'text-on-surface-variant border-outline-variant';
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body">
      {/* Header */}
      <header className="border-b border-surface-container-highest bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="font-headline font-black text-3xl sm:text-4xl tracking-tighter text-primary">
              KING OF CLAWS
            </h1>
            <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
              {t.selectRoom}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-surface-container border border-outline-variant hover:border-primary/50 transition-all step-easing group relative overflow-hidden"
            >
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Card Content */}
              <div className="relative p-6 space-y-4">
                {/* Room Name */}
                <h3 className="font-headline font-bold text-xl tracking-tight text-on-surface truncate">
                  {room.name}
                </h3>

                {/* Status & Players */}
                <div className="flex items-center justify-between">
                  <span className={`font-label text-[10px] uppercase tracking-widest px-3 py-1 border ${getStatusColor(room.status)}`}>
                    {room.status}
                  </span>
                  <span className="font-label text-sm text-on-surface-variant">
                    {room.playerCount}/4
                  </span>
                </div>

                {/* Join Button */}
                <button
                  onClick={() => onJoinRoom(room.id)}
                  className="w-full px-4 py-3 bg-primary text-on-primary font-headline font-bold text-sm uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all step-easing"
                >
                  {t.join}
                </button>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {rooms.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="font-headline text-on-surface-variant text-lg">
                {t.noRooms || 'No active rooms. Create one to start!'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container border-2 border-primary max-w-md w-full p-8 space-y-6">
            <h2 className="font-headline font-bold text-2xl tracking-tight text-primary uppercase">
              {t.createRoom}
            </h2>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
              placeholder={t.roomName}
              className="w-full px-4 py-3 bg-surface-container-highest border border-outline-variant text-on-surface font-body focus:border-primary focus:outline-none transition-colors"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={createRoom}
                disabled={loading || !newRoomName.trim()}
                className="flex-1 px-4 py-3 bg-primary text-on-primary font-headline font-bold text-sm uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all step-easing"
              >
                {loading ? t.creating || 'Creating...' : t.create}
              </button>
              <button
                onClick={() => {
                  setShowCreateRoom(false);
                  setNewRoomName('');
                }}
                className="flex-1 px-4 py-3 bg-surface-container-highest text-on-surface border border-outline-variant font-headline font-bold text-sm uppercase tracking-wider hover:border-primary/50 transition-all step-easing"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {!showCreateRoom && (
        <button
          onClick={() => setShowCreateRoom(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary flex items-center justify-center shadow-[0_0_30px_rgba(142,255,113,0.3)] hover:scale-110 active:scale-95 transition-all z-40 group"
        >
          <span className="text-4xl font-bold leading-none">+</span>
          <div className="absolute right-full mr-4 bg-surface-container-highest px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            <span className="font-headline font-bold text-xs uppercase tracking-widest">{t.createRoom}</span>
          </div>
        </button>
      )}
    </div>
  );
}
