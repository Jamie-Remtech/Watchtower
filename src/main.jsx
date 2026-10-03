import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { PopTactical } from './PopTactical.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AuthGate } from './auth/AuthGate.jsx'
import { UpdateBanner } from './components/UpdateBanner.jsx'
import { InstallPrompt } from './components/InstallPrompt.jsx'
import { I18nProvider } from './i18n/index.jsx'
import './index.css'
import { applyAppearance, loadAppearance } from './theme/theme.js'

applyAppearance(loadAppearance())

// Bundle executed fine — re-arm the white-screen recovery in index.html
try { sessionStorage.removeItem('wt-recovered') } catch { /* private mode */ }

// ?pop=tactical opens the tactical map alone in its own window,
// sharing the session and realtime data with the main app.
const isPopTactical = new URLSearchParams(window.location.search).get('pop') === 'tactical'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <I18nProvider>
      <AuthGate>
        {isPopTactical ? <PopTactical /> : <App />}
      </AuthGate>
      {/* Update notice and install button render above everything, including the login screen */}
      <UpdateBanner />
      {!isPopTactical && <InstallPrompt />}
      </I18nProvider>
    </AuthProvider>
  </StrictMode>,
)
