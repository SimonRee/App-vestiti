import { Camera } from 'lucide-react'

function Home({ onAddClothing }) {
  return (
    <section className="page">
      <header className="page-header">
        <p className="page-label">Outfit del giorno</p>
        <h1>Gasa?</h1>
      </header>

      <div className="outfit-preview">
        <p>Nessun outfit salvato</p>
      </div>

      <button
        className="camera-action"
        type="button"
        onClick={onAddClothing}
        aria-label="Aggiungi un capo"
      >
        <Camera />
      </button>
    </section>
  )
}

export default Home