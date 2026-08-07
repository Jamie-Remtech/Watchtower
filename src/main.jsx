import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AuthGate } from './auth/AuthGate.jsx'
import { UpdateBanner } from './components/UpdateBanner.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
      {/* Update notice renders above everything, including the login screen */}
      <UpdateBanner />
    </AuthProvider>
  </StrictMode>,
)
