import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import AppRouter from './routes/AppRouter'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function App() {
  const fetchUser = useAuthStore((state) => state.fetchUser)
  const initAuthListener = useAuthStore((state) => state.initAuthListener)

  useEffect(() => {
    fetchUser()
    const subscription = initAuthListener()
    return () => {
      subscription?.unsubscribe()
    }
  }, [fetchUser, initAuthListener])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
        <Analytics />
        <SpeedInsights />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
