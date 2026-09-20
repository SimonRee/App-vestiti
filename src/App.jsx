import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import './App.css'

import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import AddClothing from './pages/AddClothing'
import Archive from './pages/Archive'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Wardrobe from './pages/Wardrobe'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [previousPage, setPreviousPage] = useState('home')
  const [pendingClothingFile, setPendingClothingFile] =
    useState(null)

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  function openProfile() {
    setPreviousPage(currentPage)
    setCurrentPage('profile')
  }

  function openAddClothing() {
    setPreviousPage(currentPage)
    setPendingClothingFile(null)
    setCurrentPage('add-clothing')
  }

  function openCapturedClothing(file) {
    setPreviousPage('home')
    setPendingClothingFile(file)
    setCurrentPage('add-clothing')
  }

  function closeStandalonePage() {
    setPendingClothingFile(null)
    setCurrentPage(previousPage)
  }

  function handleClothingSaved() {
    setPendingClothingFile(null)
    setCurrentPage('archive')
  }

  function renderPage() {
    switch (currentPage) {
      case 'archive':
        return (
          <Archive onAddClothing={openAddClothing} />
        )

      case 'wardrobe':
        return <Wardrobe />

      case 'profile':
        return (
          <Profile
            email={session.user.email}
            onBack={closeStandalonePage}
            onLogout={handleLogout}
          />
        )

      case 'add-clothing':
        return (
          <AddClothing
            initialFile={pendingClothingFile}
            onBack={closeStandalonePage}
            onSaved={handleClothingSaved}
          />
        )

      case 'home':
      default:
        return (
          <Home onCaptureClothing={openCapturedClothing} />
        )
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setCurrentPage('home')
    setPreviousPage('home')
    setPendingClothingFile(null)
  }

  if (authLoading) {
    return <div className="auth-page">Caricamento...</div>
  }

  if (!session) {
    return <Auth />
  }

  const isStandalonePage =
    currentPage === 'profile' ||
    currentPage === 'add-clothing'

  return (
    <div className="app">
      {!isStandalonePage && (
        <button
          className="profile-button"
          type="button"
          onClick={openProfile}
          aria-label="Apri profilo"
        >
          <UserRound />
        </button>
      )}

      <main className="app-content">
        {renderPage()}
      </main>

      {!isStandalonePage && (
        <Navbar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      )}
    </div>
  )
}

export default App