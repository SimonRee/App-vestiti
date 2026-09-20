import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

function Archive({ onAddClothing }) {
  const [clothes, setClothes] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

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
            <article className="clothing-card" key={item.id}>
              <div className="clothing-card-image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} />
                ) : (
                  <span>Immagine non disponibile</span>
                )}
              </div>

              <div className="clothing-card-info">
                <h2>{item.name}</h2>
                <p>{item.category}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Archive