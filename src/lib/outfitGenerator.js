import { supabase } from './supabase'
import { attachImages, automaticLayout } from './outfits'

const TOP_CATEGORIES = [
  'T-shirt',
  'Camicia',
  'Felpa',
  'Maglione',
  'Giacca',
  'Cappotto',
]

const BOTTOM_CATEGORIES = [
  'Pantaloni',
  'Jeans',
  'Shorts',
]

function randomItem(items) {
  if (!items.length) return null

  return items[Math.floor(Math.random() * items.length)]
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function combinationKey(items) {
  return items
    .map((item) => item.id)
    .sort()
    .join('|')
}

export async function generateRandomOutfit(previousKey = '') {
  const { data, error } = await supabase
    .from('clothes')
    .select('id, category, image_path, thumbnail_path, brand, color, seasons')
    .order('created_at', { ascending: false })

  if (error) throw error

  if (!data?.length) {
    throw new Error('Aggiungi almeno due capi all’Archivio.')
  }

  const tops = data.filter((item) =>
    TOP_CATEGORIES.includes(item.category),
  )

  const bottoms = data.filter((item) =>
    BOTTOM_CATEGORIES.includes(item.category),
  )

  const shoes = data.filter((item) => item.category === 'Scarpe')
  const accessories = data.filter(
    (item) => item.category === 'Accessorio',
  )

  const pool = []

  // Un solo capo della parte superiore.
  if (tops.length) pool.push(randomItem(tops))

  // Un solo capo della parte inferiore.
  if (bottoms.length) pool.push(randomItem(bottoms))

  // Un solo paio di scarpe.
  if (shoes.length) pool.push(randomItem(shoes))

  // L’accessorio è opzionale.
  if (accessories.length && Math.random() > 0.5) {
    pool.push(randomItem(accessories))
  }

  let selected = pool.filter(Boolean)

  // Se il guardaroba è piccolo, aggiunge altri capi disponibili
  // senza duplicare categorie già presenti.
  if (selected.length < 2) {
    const usedIds = new Set(selected.map((item) => item.id))
    const remaining = shuffle(
      data.filter((item) => !usedIds.has(item.id)),
    )

    for (const item of remaining) {
      if (selected.length >= 2) break
      if (selected.some((current) => current.category === item.category)) {
        continue
      }

      selected.push(item)
    }
  }

  if (selected.length < 2) {
    throw new Error('Servono almeno due categorie di capi nell’Archivio.')
  }

  // Evita di riproporre la stessa combinazione quando ci sono alternative.
  let key = combinationKey(selected)

  if (key === previousKey && data.length > selected.length) {
    for (let attempt = 0; attempt < 8 && key === previousKey; attempt += 1) {
      const alternative = shuffle(data)
      const replacement = alternative.find((item) => {
        const sameCategory = selected.some(
          (current) => current.category === item.category,
        )

        return !sameCategory
      })

      if (replacement) {
        const replaceIndex = Math.floor(Math.random() * selected.length)
        selected = [
          ...selected.slice(0, replaceIndex),
          replacement,
          ...selected.slice(replaceIndex + 1),
        ]
        key = combinationKey(selected)
      }
    }
  }

  const withImages = await attachImages(selected, true)
  const items = automaticLayout(withImages)

  return {
    key,
    items,
  }
}