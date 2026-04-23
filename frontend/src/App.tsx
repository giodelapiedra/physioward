import React, { useEffect } from 'react'
import { useAuthStore } from './store/auth.store'
import LoginPage from './components/Auth/LoginPage'
import DashboardPage from './components/Dashboard/DashboardPage'

export default function App() {
  const { isAuthenticated, isLoading, refreshToken } = useAuthStore()

  // On app load — try to restore session via refresh token cookie
  useEffect(() => {
    refreshToken()
  }, [])

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#f0f2f5', fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid #e5e7eb', borderTop: '3px solid #0f6e56',
            borderRadius: '50%', margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 14, color: '#6b7280' }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return isAuthenticated ? <DashboardPage /> : <LoginPage />
}
