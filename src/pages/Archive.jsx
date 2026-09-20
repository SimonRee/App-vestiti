import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 24

function Archive({ onAddClothing, onEditClothing }) {
  const [clothes, setClothes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const pointerGesture = useRef(null)
  const nextPage = useRef(0)
  const loadingPage = useRef(false)
  const loadMoreMarker = useRef(null)

  const loadClothesPage = useCallback(async (pageIndex) => {
    if (loadingPage.current) {
      return
    }

    loadingPage.current = true

    if (pageIndex === 0) {
      setLoading(true)
      setErrorMessage('')
    } else {
      setLoadingMore(true)
    }

    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      const { data, error } = await supabase
        .from('clothes')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        throw error
      }

      const imagePaths = [
        ...new Set(
          data.flatMap((item) => [
            item.image_path,
            item.thumbnail_path,
          ]).filter(Boolean),
        ),
      ]

      let signedUrlMap = new Map()

      if (imagePaths.length > 0) {
        const {
          data: signedUrls,
          error: signedUrlsError,
        } = await supabase.storage
          .from('clothes-images')
          .createSignedUrls(imagePaths, 3600)

        if (signedUrlsError) {
          throw signedUrlsError
        }

        signedUrlMap = new Map(
          signedUrls.map((item) => [
            item.path,
            item.signedUrl,
          ]),
        )
      }

      const clothesWithImages = data.map((item) => {
        const mainImageUrl =
          signedUrlMap.get(item.image_path) || null

        const thumbnailUrl = item.thumbnail_path
          ? signedUrlMap.get(item.thumbnail_path)
          : mainImageUrl

        return {
          ...item,
          imageUrl: mainImageUrl,
          thumbnailUrl: thumbnailUrl || mainImageUrl,
        }
      })

      setClothes((currentClothes) => {
        if (pageIndex === 0) {
          return clothesWithImages
        }

        return [
          ...currentClothes,
          ...clothesWithImages,
        ]
      })

      nextPage.current = pageIndex + 1
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      setErrorMessage(
        error.message ||
          'Non è stato possibile caricare l’archivio.',
      )
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingPage.current = false
    }
  }, [])

  useEffect(() => {
    loadClothesPage(0)
  }, [loadClothesPage])

  useEffect(() => {
    const marker = loadMoreMarker.current

    if (!marker || !hasMore || loading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingPage.current
        ) {
          loadClothesPage(nextPage.current)
        }
      },
      {
        rootMargin: '300px',
      },
    )

    observer.observe(marker)

    return () => {
      observer.disconnect()
    }
  }, [
    clothes.length,
    hasMore,
    loading,
    loadClothesPage,
  ])

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

      {!loading && clothes.length > 0 && (
        <>
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
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  ) : (
                    <span>Immagine non disponibile</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {hasMore && (
            <div
              ref={loadMoreMarker}
              className="archive-load-more"
              aria-hidden="true"
            >
              {loadingMore && 'Caricamento...'}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default Archive