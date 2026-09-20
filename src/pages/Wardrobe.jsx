import { Plus } from 'lucide-react'

function Wardrobe() {
  return (
    <section className="page">
      <header className="page-header page-header-row">
        <div>
          <p className="page-label">Le tue combinazioni</p>
          <h1>Armadio</h1>
        </div>

        <button
          className="add-button"
          aria-label="Crea un outfit"
        >
          <Plus />
        </button>
      </header>

      <div className="empty-state">
        <p>Non hai ancora creato nessun outfit.</p>
      </div>
    </section>
  )
}

export default Wardrobe