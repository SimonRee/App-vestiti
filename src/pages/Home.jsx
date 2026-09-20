import { Camera } from 'lucide-react'

function Home() {
  return (
    <section className="page">
      <header className="page-header">
        <p className="page-label">Outfit del giorno</p>
        <h1>Oggi potresti indossare</h1>
      </header>

      <div className="outfit-preview">
        <p>Nessun outfit salvato</p>
      </div>

      <button
        className="camera-action"
        aria-label="Aggiungi un capo"
      >
        <Camera />
      </button>
    </section>
  )
}

export default Home