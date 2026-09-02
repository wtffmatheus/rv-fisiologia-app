import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PWAExperience from './components/PWAExperience'
import './styles.css'
import './feature.css'
import './ui-fixes.css'

// RV_PWA_SERVICE_WORKER_V3
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      })

      // Confere uma nova versão do service worker quando o usuário volta ao app.
      const checkWorker = () => registration.update().catch(() => undefined)

      window.addEventListener('focus', checkWorker)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkWorker()
      })
    } catch (error) {
      console.error('Falha ao registrar o PWA:', error)
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PWAExperience />
  </StrictMode>,
)
