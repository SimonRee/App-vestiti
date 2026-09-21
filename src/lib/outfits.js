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

export function automaticLayout(clothes) {
  const templates = {
    outer: { x: 0.34, y: 0.30, size: 0.60, angle: -7, layer: 0 },
    bottom: { x: 0.43, y: 0.67, size: 0.63, angle: -3, layer: 10 },
    top: { x: 0.56, y: 0.30, size: 0.55, angle: 6, layer: 20 },
    shoes: { x: 0.77, y: 0.78, size: 0.32, angle: 0, layer: 30 },
    accessory: { x: 0.79, y: 0.48, size: 0.25, angle: 8, layer: 40 },
  }

  const counters = {}

  return clothes.map((clothing) => {
    const group = groupOf(clothing.category)
    const template = templates[group]
    const index = counters[group] || 0
    counters[group] = index + 1

    // Sfalsa eventuali capi appartenenti allo stesso gruppo.
    const offset = (index % 3) * 0.045

    return {
      clothing_id: clothing.id,
      clothing,
      position_x: Math.min(0.88, template.x + offset),
      position_y: Math.min(0.88, template.y + offset),
      scale: template.size,
      rotation: template.angle + (index % 2 ? -8 : 0),
      z_index: template.layer + index,
    }
  })
}