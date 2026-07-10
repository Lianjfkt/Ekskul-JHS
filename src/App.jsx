import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AppRouter from './routes/AppRouter'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

function App() {
  const fetchUser = useAuthStore((state) => state.fetchUser)

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <BrowserRouter>
      <AppRouter />
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  )
}

export default App
