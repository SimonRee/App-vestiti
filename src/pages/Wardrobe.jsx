import { Plus } from 'lucide-react'
import OutfitCanvas from '../components/OutfitCanvas'
import TapButton from '../components/TapButton'
import { MoreOutfits, useOutfitPages } from '../hooks/useOutfitPages'

function Wardrobe({ onCreateOutfit, onEditOutfit }) {
  const pager = useOutfitPages('outfits')

  return (
    <section className="page">
      <header className="page-header page-header-row">
        <div>
          <p className="page-label">Le tue combinazioni</p>
          <h1>Armadio</h1>
        </div>

        <button
          className="add-button"
          type="button"
          onClick={onCreateOutfit}
          aria-label="Crea un outfit"
        >
          <Plus />
        </button>
      </header>

      {!pager.loading && !pager.error && pager.rows.length === 0 && (
        <div className="empty-state">
          <p>Non hai ancora creato nessun outfit.</p>
        </div>
      )}

      <div className="clothes-grid">
        {pager.rows.map((outfit, index) => (
          <TapButton
            key={outfit.id}
            className="outfit-grid-button"
            aria-label={`Apri outfit ${index + 1}`}
            onClick={() => onEditOutfit(outfit)}
          >
            <OutfitCanvas items={outfit.items} />
          </TapButton>
        ))}
      </div>

      <MoreOutfits pager={pager} />
    </section>
  )
}

export default Wardrobe