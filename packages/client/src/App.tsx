import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext.js';
import Lobby from './components/Lobby.js';
import GameBoard from './components/GameBoard.js';
import PlayerPage from './components/PlayerPage.js';

function LobbyWrapper() {
  const navigate = useNavigate();
  return <Lobby onJoinRoom={(roomId) => navigate(`/room/${roomId}`)} />;
}

function GameBoardWrapper() {
  const navigate = useNavigate();
  const roomId = window.location.pathname.split('/room/')[1];
  return <GameBoard roomId={roomId} onBack={() => navigate('/')} />;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LobbyWrapper />} />
          <Route path="/room/:roomId" element={<GameBoardWrapper />} />
          <Route path="/player/:token" element={<PlayerPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
