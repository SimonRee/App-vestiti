import { Plus } from 'lucide-react'

function Archive() {
  return (
    <section className="page">
      <header className="page-header page-header-row">
        <div>
          <p className="page-label">I tuoi vestiti</p>
          <h1>Archivio</h1>
        </div>

        <button
          className="add-button"
          aria-label="Aggiungi un capo"
        >
          <Plus />
        </button>
      </header>

      <div className="empty-state">
        <p>Non hai ancora aggiunto nessun capo.</p>
      </div>
    </section>
  )
}

export default Archive