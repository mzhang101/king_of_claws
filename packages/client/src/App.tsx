import { useState } from 'react';
import Lobby from './components/Lobby.js';
import GameBoard from './components/GameBoard.js';

export default function App() {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  if (currentRoom) {
    return (
      <GameBoard
        roomId={currentRoom}
        onBack={() => setCurrentRoom(null)}
      />
    );
  }

  return <Lobby onJoinRoom={setCurrentRoom} />;
}
