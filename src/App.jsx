import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import './App.css'

import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import AddClothing from './pages/AddClothing'
import Archive from './pages/Archive'
import Auth from './pages/Auth'
import EditClothing from './pages/EditClothing'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Wardrobe from './pages/Wardrobe'
import OutfitEditor from './pages/OutfitEditor'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [previousPage, setPreviousPage] = useState('home')

  const [pendingClothingFile, setPendingClothingFile] =
    useState(null)

  const [selectedClothing, setSelectedClothing] =
    useState(null)

  const [selectedOutfit, setSelectedOutfit] = useState(null)
  const [generatedOutfitItems, setGeneratedOutfitItems] = useState([])
  const [outfitOriginPage, setOutfitOriginPage] = useState('wardrobe')

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

  function openEditClothing(clothing) {
    setPreviousPage('archive')
    setSelectedClothing(clothing)
    setCurrentPage('edit-clothing')
  }

  function closeStandalonePage() {
    setPendingClothingFile(null)
    setSelectedClothing(null)
    setCurrentPage(previousPage)
  }

  function handleClothingSaved() {
    setPendingClothingFile(null)
    setSelectedClothing(null)
    setCurrentPage('archive')
  }

  function handleClothingDeleted() {
    setSelectedClothing(null)
    setCurrentPage('archive')
  }

  function openNewOutfit() {
  setSelectedOutfit(null)
  setGeneratedOutfitItems([])
  setOutfitOriginPage('wardrobe')
  setCurrentPage('outfit-editor')
}

function openEditOutfit(outfit) {
  setSelectedOutfit(outfit)
  setGeneratedOutfitItems([])
  setOutfitOriginPage('wardrobe')
  setCurrentPage('outfit-editor')
}

function openGeneratedOutfit(items) {
  setSelectedOutfit(null)
  setGeneratedOutfitItems(items)
  setOutfitOriginPage('home')
  setCurrentPage('outfit-editor')
}

function returnFromOutfit(saved = false) {
  setSelectedOutfit(null)

  if (saved) {
    setGeneratedOutfitItems([])
    setCurrentPage('wardrobe')
    return
  }

  setCurrentPage(outfitOriginPage)
}

  function renderPage() {
    switch (currentPage) {
      case 'archive':
        return (
          <Archive
            onAddClothing={openAddClothing}
            onEditClothing={openEditClothing}
          />
        )

      case 'wardrobe':
  return (
    <Wardrobe
      onCreateOutfit={openNewOutfit}
      onEditOutfit={openEditOutfit}
    />
  )

case 'outfit-editor':
  return (
    <OutfitEditor
      key={`${session.user.id}:${selectedOutfit?.id || 'generated'}`}
      outfit={selectedOutfit}
      initialItems={generatedOutfitItems}
      userId={session.user.id}
      onBack={() => returnFromOutfit(false)}
      onSaved={() => returnFromOutfit(true)}
    />
  )

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

      case 'edit-clothing':
        return selectedClothing ? (
          <EditClothing
            clothing={selectedClothing}
            onBack={closeStandalonePage}
            onSaved={handleClothingSaved}
            onDeleted={handleClothingDeleted}
          />
        ) : (
          <Archive
            onAddClothing={openAddClothing}
            onEditClothing={openEditClothing}
          />
        )

      case 'home':
      default:
        return (
          <Home
  generatedItemsFromApp={generatedOutfitItems}
  onCaptureClothing={openCapturedClothing}
  onOpenGeneratedOutfit={openGeneratedOutfit}
  onGeneratedOutfit={setGeneratedOutfitItems}
/>
        )
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setCurrentPage('home')
    setPreviousPage('home')
    setPendingClothingFile(null)
    setSelectedClothing(null)
    setSelectedOutfit(null)
    setGeneratedOutfitItems([])
    setOutfitOriginPage('wardrobe')
  }

  if (authLoading) {
    return <div className="auth-page">Caricamento...</div>
  }

  if (!session) {
    return <Auth />
  }

  const isStandalonePage =
    currentPage === 'profile' ||
    currentPage === 'add-clothing' ||
    currentPage === 'edit-clothing' ||
    currentPage === 'outfit-editor'

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