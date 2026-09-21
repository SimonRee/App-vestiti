import { supabase } from './supabase'

export const outfitCategories = [
  'T-shirt',
  'Camicia',
  'Felpa',
  'Maglione',
  'Giacca',
  'Cappotto',
  'Pantaloni',
  'Jeans',
  'Shorts',
  'Scarpe',
  'Accessorio',
]

export function serializeItems(items) {
  return items.map((item) => ({
    clothing_id: item.clothing_id,
    position_x: Number(item.position_x),
    position_y: Number(item.position_y),
    scale: Number(item.scale),
    rotation: Number(item.rotation),
    z_index: Number(item.z_index),
  }))
}

export async function attachImages(clothes, fullSize = false) {
  if (!clothes.length) return []

  const pathFor = (item) =>
    fullSize
      ? item.image_path
      : item.thumbnail_path || item.image_path

  const paths = [...new Set(clothes.map(pathFor).filter(Boolean))]

  if (!paths.length) {
    return clothes.map((item) => ({ ...item, imageUrl: null }))
  }

  const { data, error } = await supabase.storage
    .from('clothes-images')
    .createSignedUrls(paths, 3600)

  if (error) throw error

  const urls = new Map(
    data.map((item) => [item.path, item.signedUrl || null]),
  )

  return clothes.map((item) => ({
    ...item,
    imageUrl: urls.get(pathFor(item)) || null,
  }))
}

export async function hydrateItems(items) {
  if (!items.length) return []

  const ids = [...new Set(items.map((item) => item.clothing_id))]

  const { data, error } = await supabase
    .from('clothes')
    .select('id, category, image_path, thumbnail_path')
    .in('id', ids)

  if (error) throw error

  const images = await attachImages(data, true)
  const byId = new Map(images.map((item) => [item.id, item]))

  return items
    .filter((item) => byId.has(item.clothing_id))
    .map((item) => ({
      ...item,
      clothing: byId.get(item.clothing_id),
    }))
}

function groupOf(category) {
  if (['Giacca', 'Cappotto'].includes(category)) return 'outer'
  if (['Pantaloni', 'Jeans', 'Shorts'].includes(category)) return 'bottom'
  if (category === 'Scarpe') return 'shoes'
  if (category === 'Accessorio') return 'accessory'

  return 'top'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function automaticLayout(clothes) {
  const hasOuter = clothes.some(
    (clothing) => groupOf(clothing.category) === 'outer',
  )

  const templates = {
    outer: {
      x: 0.41,
      y: 0.40,
      size: 0.76,
      angle: -3,
      layer: 0,
    },

    bottom: {
      x: 0.44,
      y: 0.62,
      size: 0.74,
      angle: -2,
      layer: 20,
    },

    top: {
      x: hasOuter ? 0.56 : 0.50,
      y: 0.36,
      size: 0.70,
      angle: 3,
      layer: 40,
    },

    shoes: {
      x: 0.73,
      y: 0.76,
      size: 0.42,
      angle: 0,
      layer: 60,
    },

    accessory: {
      x: 0.76,
      y: 0.43,
      size: 0.30,
      angle: 5,
      layer: 80,
    },
  }

  const counters = {}

  // Manteniamo l’ordine ricevuto: l’editor lo usa quando aggiunge un capo.
  return clothes.map((clothing) => {
    const group = groupOf(clothing.category)
    const template = templates[group]

    const index = counters[group] || 0
    counters[group] = index + 1

    const offsetX = index === 0
      ? 0
      : ((index % 3) - 1) * 0.025

    const offsetY = index * 0.015
    const rotation = template.angle + (index % 2 ? -4 : 0)

    // Mantiene dentro il riquadro anche gli angoli dell’immagine ruotata.
    // Non analizza pixel, trasparenza o contenuto della foto.
    const radians = rotation * Math.PI / 180

    const halfExtent = (
      template.size *
      (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)))
    ) / 2

    const minCenter = halfExtent + 0.015
    const maxCenter = 1 - minCenter

    return {
      clothing_id: clothing.id,
      clothing,

      position_x: clamp(
        template.x + offsetX,
        minCenter,
        maxCenter,
      ),

      position_y: clamp(
        template.y + offsetY,
        minCenter,
        maxCenter,
      ),

      scale: template.size,
      rotation,
      z_index: template.layer + index,
    }
  })
}

// Mantiene compatibili le chiamate già presenti in OutfitEditor.
export async function compactAutomaticLayout(clothes) {
  return automaticLayout(clothes)
}