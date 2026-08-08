import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AuthGate } from './auth/AuthGate.jsx'
import { UpdateBanner } from './components/UpdateBanner.jsx'
import { InstallPrompt } from './components/InstallPrompt.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
      {/* Update notice and install button render above everything, including the login screen */}
      <UpdateBanner />
      <InstallPrompt />
    </AuthProvider>
  </StrictMode>,
)
