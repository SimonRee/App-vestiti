import { useState } from 'react'
import './App.css'

import Navbar from './components/Navbar'
import Archive from './pages/Archive'
import Home from './pages/Home'
import Wardrobe from './pages/Wardrobe'

function App() {
  const [currentPage, setCurrentPage] = useState('home')

  function renderPage() {
    switch (currentPage) {
      case 'archive':
        return <Archive />

      case 'wardrobe':
        return <Wardrobe />

      case 'home':
      default:
        return <Home />
    }
  }

  return (
    <div className="app">
      <main className="app-content">
        {renderPage()}
      </main>

      <Navbar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  )
}

export default App