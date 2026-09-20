import { Grid2X2, House, Shirt } from 'lucide-react'

function Navbar({ currentPage, setCurrentPage }) {
  return (
    <nav className="navbar">
      <button
        className={`nav-button ${
          currentPage === 'archive' ? 'nav-button-active' : ''
        }`}
        onClick={() => setCurrentPage('archive')}
        aria-label="Apri archivio"
      >
        <Grid2X2 />
        <span>Archivio</span>
      </button>

      <button
        className={`nav-button ${
          currentPage === 'home' ? 'nav-button-active' : ''
        }`}
        onClick={() => setCurrentPage('home')}
        aria-label="Apri home"
      >
        <House />
        <span>Home</span>
      </button>

      <button
        className={`nav-button ${
          currentPage === 'wardrobe' ? 'nav-button-active' : ''
        }`}
        onClick={() => setCurrentPage('wardrobe')}
        aria-label="Apri armadio"
      >
        <Shirt />
        <span>Armadio</span>
      </button>
    </nav>
  )
}

export default Navbar