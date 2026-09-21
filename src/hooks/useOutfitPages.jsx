import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { attachImages } from '../lib/outfits'

const PAGE_SIZE = 24

export function useOutfitPages(kind, category = '') {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        let query = supabase
          .from(kind === 'clothes' ? 'clothes' : 'outfits')
          .select(
            kind === 'clothes'
              ? 'id, category, image_path, thumbnail_path, created_at'
              : `id, created_at, updated_at,
                 outfit_items(
                   clothing_id, position_x, position_y,
                   scale, rotation, z_index,
                   clothing:clothes(id, category, image_path, thumbnail_path)
                 )`,
          )
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

        if (kind === 'clothes' && category) {
          query = query.eq('category', category)
        }

        const { data, error: queryError } = await query.range(
          page * PAGE_SIZE,
          (page + 1) * PAGE_SIZE - 1,
        )

        if (queryError) throw queryError

        let ready

        if (kind === 'clothes') {
          ready = await attachImages(data)
        } else {
          const clothes = data.flatMap((outfit) =>
            outfit.outfit_items
              .map((item) => item.clothing)
              .filter(Boolean),
          )

          const unique = [...new Map(
            clothes.map((item) => [item.id, item]),
          ).values()]

          const images = await attachImages(unique)
          const byId = new Map(images.map((item) => [item.id, item]))

          ready = data.map((outfit) => ({
            ...outfit,
            items: outfit.outfit_items
              .filter((item) => item.clothing)
              .map((item) => ({
                ...item,
                clothing: byId.get(item.clothing_id),
              })),
          }))
        }

        if (cancelled) return

        setRows((previous) => {
          const combined = page === 0 ? ready : [...previous, ...ready]
          return [...new Map(combined.map((item) => [item.id, item])).values()]
        })

        setHasMore(data.length === PAGE_SIZE)
      } catch (problem) {
        if (!cancelled) setError(problem.message || 'Caricamento non riuscito.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [kind, category, page, retry])

  return {
    rows,
    loading,
    hasMore,
    error,
    loadMore: () => {
      if (!loading && hasMore && !error) setPage((value) => value + 1)
    },
    retry: () => setRetry((value) => value + 1),
  }
}

export function MoreOutfits({ pager }) {
  const marker = useRef(null)
  const { loading, hasMore, error, loadMore } = pager

  useEffect(() => {
    if (loading || !hasMore || error || !marker.current) return
    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: '200px' },
    )

    observer.observe(marker.current)
    return () => observer.disconnect()
  }, [loading, hasMore, error, loadMore])

  return (
    <div className="archive-load-more" ref={marker}>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="outfit-secondary" onClick={pager.retry}>
            Riprova
          </button>
        </div>
      ) : loading ? (
        <p role="status">Caricamento…</p>
      ) : hasMore ? (
        <button type="button" className="outfit-secondary" onClick={loadMore}>
          Carica altri
        </button>
      ) : null}
    </div>
  )
}