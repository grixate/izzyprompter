import { DisplayPage } from './pages/DisplayPage'
import { RemotePage } from './pages/RemotePage'
import { StartPage } from './pages/StartPage'

function App() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const [surface, rawSessionId] = parts
  const sessionId = rawSessionId?.toUpperCase() ?? null

  if (surface === 'display' && sessionId) return <DisplayPage sessionId={sessionId} />
  if (surface === 'remote' && sessionId) return <RemotePage sessionId={sessionId} />
  return <StartPage />
}

export default App
