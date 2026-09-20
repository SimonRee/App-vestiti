import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

function Archive({ onAddClothing, onEditClothing }) {
  const [clothes, setClothes] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const pointerGesture = useRef(null)

  useEffect(() => {
    loadClothes()
  }, [])

  async function loadClothes() {
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('clothes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    const clothesWithImages = await Promise.all(
      data.map(async (item) => {
        const { data: signedUrlData, error: imageError } =
          await supabase.storage
            .from('clothes-images')
            .createSignedUrl(item.image_path, 3600)

        return {
          ...item,
          imageUrl: imageError
            ? null
            : signedUrlData.signedUrl,
        }
      }),
    )

    setClothes(clothesWithImages)
    setLoading(false)
  }

  function handlePointerDown(event, item) {
    pointerGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      item,
    }
  }

  function handlePointerMove(event) {
    const gesture = pointerGesture.current

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }

    const distanceX = Math.abs(event.clientX - gesture.startX)
    const distanceY = Math.abs(event.clientY - gesture.startY)

    if (distanceX > 10 || distanceY > 10) {
      gesture.moved = true
    }
  }

  function handlePointerUp(event) {
    const gesture = pointerGesture.current

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }

    if (!gesture.moved) {
      onEditClothing(gesture.item)
    }

    pointerGesture.current = null
  }

  function handlePointerCancel() {
    pointerGesture.current = null
  }

  function handleCardKeyDown(event, item) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onEditClothing(item)
    }
  }

  return (
    <section className="page">
      <header className="page-header page-header-row">
        <div>
          <p className="page-label">I tuoi vestiti</p>
          <h1>Archivio</h1>
        </div>

        <button
          className="add-button"
          type="button"
          onClick={onAddClothing}
          aria-label="Aggiungi un capo"
        >
          <Plus />
        </button>
      </header>

      {loading && (
        <div className="empty-state">
          <p>Caricamento...</p>
        </div>
      )}

      {!loading && errorMessage && (
        <div className="empty-state">
          <p>{errorMessage}</p>
        </div>
      )}

      {!loading && !errorMessage && clothes.length === 0 && (
        <div className="empty-state">
          <p>Non hai ancora aggiunto nessun capo.</p>
        </div>
      )}

      {!loading && !errorMessage && clothes.length > 0 && (
        <div className="clothes-grid">
          {clothes.map((item) => (
            <article
              className="clothing-card"
              key={item.id}
              role="button"
              tabIndex="0"
              aria-label={`Modifica capo: ${item.category}`}
              onPointerDown={(event) =>
                handlePointerDown(event, item)
              }
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onKeyDown={(event) =>
                handleCardKeyDown(event, item)
              }
            >
              <div className="clothing-card-image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" />
                ) : (
                  <span>Immagine non disponibile</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Archive