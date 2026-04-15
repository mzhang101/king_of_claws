// ============================================================
// King of Claws — Lobby Component (Retro-Geek Modernism)
// ============================================================

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

  const statusBadge = (status: string) => {
    const styles = {
      waiting: 'bg-secondary/20 text-secondary border-secondary/30',
      countdown: 'bg-tertiary/20 text-tertiary border-tertiary/30',
      playing: 'bg-primary/20 text-primary border-primary/30',
      finished: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30',
    };

    const labels = {
      waiting: t.waiting,
      countdown: 'STARTING',
      playing: t.playing,
      finished: t.finished,
    };

    const style = styles[status as keyof typeof styles] || 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30';
    const label = labels[status as keyof typeof labels] || status.toUpperCase();

    return (
      <span className={`inline-block px-3 py-1 border text-[10px] font-label font-bold tracking-[0.15em] uppercase ${style}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-screen w-64 bg-surface-container-low border-r border-surface-container-highest">
        {/* Logo */}
        <div className="p-6 border-b border-surface-container-highest">
          <h2 className="font-headline font-black text-xl tracking-tighter text-primary">
            KING_OF_CLAWS
          </h2>
          <p className="font-label text-[8px] text-on-surface-variant tracking-[0.3em] mt-2 opacity-50">
            LOBBY_SYSTEM_v2.0
          </p>
        </div>

        {/* Navigation - placeholder for future */}
        <nav className="flex-1 p-6">
          {/* Can add navigation links here */}
        </nav>

        {/* Footer */}
        <div className="p-6 border-t border-surface-container-highest">
          <LanguageToggle />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Bar - Mobile only */}
        <header className="md:hidden bg-surface-container-low px-6 py-4 flex items-center justify-between border-b border-surface-container-highest">
          <h1 className="font-headline font-black text-xl tracking-tighter text-primary">
            {t.title}
          </h1>
          <LanguageToggle />
        </header>

        {/* Hero Section */}
        <section className="p-6 md:p-12 bg-surface-dim">
          <h1 className="font-headline font-black text-4xl md:text-7xl tracking-tighter text-primary mb-8">
            {t.title}
          </h1>

          {/* Create Room */}
          <div className="flex flex-col md:flex-row gap-4 max-w-4xl">
            <input
              type="text"
              placeholder={t.roomNamePlaceholder}
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
              className="flex-1 bg-surface-container-low px-6 py-4 text-body-lg text-on-surface placeholder-on-surface-variant/50 border-b-2 border-outline/30 focus:border-tertiary focus:outline-none transition-all"
              style={{ borderRadius: 0 }}
            />
            <button
              onClick={createRoom}
              disabled={loading || !newRoomName.trim()}
              className="px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-body-md uppercase tracking-wider hover:shadow-[0_0_30px_rgba(142,255,113,0.3)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all step-easing"
              style={{ borderRadius: 0 }}
            >
              {loading ? t.loading : 'INITIALIZE'}
            </button>
          </div>
        </section>

        {/* Room List Section */}
        <section className="p-6 md:p-8 flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline font-bold text-xl md:text-2xl tracking-tight text-on-surface uppercase">
              {t.activeArenas}
            </h2>
            <button
              onClick={fetchRooms}
              className="px-4 py-2 bg-surface-container-highest text-on-surface-variant hover:text-primary border border-outline-variant/30 hover:border-primary/50 font-label text-[10px] uppercase tracking-[0.15em] transition-all step-easing"
              style={{ borderRadius: 0 }}
            >
              REFRESH
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-24 bg-surface-container-low border border-outline-variant/20">
              <p className="text-6xl mb-6">🦞</p>
              <p className="text-on-surface-variant text-body-lg uppercase tracking-wider font-label">
                NO ARENAS FOUND
              </p>
              <p className="text-on-surface-variant/50 text-body-sm mt-2">
                Initialize one to begin
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => onJoinRoom(room.id)}
                  className="col-span-12 md:col-span-4 bg-surface-container-low border-l-4 border-primary p-6 hover:bg-surface-container-highest transition-all step-easing text-left group"
                  style={{ borderRadius: 0 }}
                >
                  {/* Room Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-headline font-bold text-body-lg text-primary">
                      #{room.id.slice(0, 6)}
                    </span>
                    {statusBadge(room.status)}
                  </div>

                  {/* Room Name */}
                  <h3 className="font-headline font-bold text-xl text-on-surface mb-3 group-hover:text-primary transition-colors">
                    {room.name}
                  </h3>

                  {/* Room Stats */}
                  <div className="flex items-center gap-4 text-body-sm text-on-surface-variant font-label uppercase tracking-wider">
                    <span>{room.playerCount}/{room.maxPlayers} {t.players}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Footer Branding */}
        <footer className="p-6 md:p-8 flex justify-center items-center bg-surface-container-low border-t border-surface-container-highest">
          <div className="flex items-center space-x-4 opacity-40 hover:opacity-100 transition-opacity cursor-default">
            <span className="font-headline font-black text-[10px] tracking-tighter text-on-surface">
              POWERED_BY
            </span>
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="font-headline font-black text-[10px] text-on-primary">KC</span>
            </div>
            <span className="font-headline font-black text-[10px] tracking-tighter text-on-surface">
              KING_OF_CLAWS
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
