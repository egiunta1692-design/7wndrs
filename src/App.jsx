import { Routes, Route } from 'react-router-dom'
import Auth from './pages/Auth'
import Lobby from './pages/Lobby'
import Game from './pages/Game'

export default function App() {
  return (
    <Auth>
      {({ profile, signOut }) => (
        <Routes>
          <Route path="/" element={<Lobby profile={profile} onSignOut={signOut} />} />
          <Route path="/game/:gameId" element={<Game profile={profile} />} />
        </Routes>
      )}
    </Auth>
  )
}
