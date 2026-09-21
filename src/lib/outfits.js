import { supabase } from './supabase'
import { measureClothingImage } from './imageBounds'

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

function rotatePoint(x, y, degrees) {
  const radians = degrees * Math.PI / 180

  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  }
}

function visibleRectangle(item, geometry) {
  const points = []

  for (const horizontal of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      const point = rotatePoint(
        (geometry.offsetX + horizontal * geometry.width / 2) * item.scale,
        (geometry.offsetY + vertical * geometry.height / 2) * item.scale,
        item.rotation,
      )

      points.push({
        x: item.position_x + point.x,
        y: item.position_y + point.y,
      })
    }
  }

  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  }
}

function placeClothing(clothing, geometry, settings) {
  const scale = settings.size / Math.max(geometry.width, geometry.height)

  const offset = rotatePoint(
    geometry.offsetX * scale,
    geometry.offsetY * scale,
    settings.angle,
  )

  return {
    clothing_id: clothing.id,
    clothing,
    position_x: settings.x - offset.x,
    position_y: settings.y - offset.y,
    scale,
    rotation: settings.angle,
    z_index: settings.layer,
  }
}

export async function compactAutomaticLayout(clothes) {
  if (!clothes.length) return []

  const geometryById = new Map()

  // Al massimo tre immagini analizzate insieme.
  for (let index = 0; index < clothes.length; index += 3) {
    await Promise.all(
      clothes.slice(index, index + 3).map(async (clothing) => {
        const geometry = await measureClothingImage(clothing.imageUrl)
        geometryById.set(clothing.id, geometry)
      }),
    )
  }

  const groups = {
    outer: [],
    top: [],
    bottom: [],
    shoes: [],
    accessory: [],
  }

  for (const clothing of clothes) {
    groups[groupOf(clothing.category)].push(clothing)
  }

  // Il risultato non dipende dall’ordine dei tocchi nella selezione.
  Object.values(groups).forEach((group) => {
    group.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  })

  const result = []

  function addGroup(name, settings) {
    const added = groups[name].map((clothing, index) => {
      const offset = index * 0.045

      return placeClothing(clothing, geometryById.get(clothing.id), {
        ...settings,
        x: settings.x + offset,
        y: settings.y + offset,
        angle: settings.angle + (index % 2 ? -5 : 0),
        layer: settings.layer + index,
      })
    })

    result.push(...added)
    return added
  }

  function boundsOf(items) {
    const rectangles = items.map((item) =>
      visibleRectangle(item, geometryById.get(item.clothing_id)),
    )

    return {
      left: Math.min(...rectangles.map((rectangle) => rectangle.left)),
      right: Math.max(...rectangles.map((rectangle) => rectangle.right)),
      top: Math.min(...rectangles.map((rectangle) => rectangle.top)),
      bottom: Math.max(...rectangles.map((rectangle) => rectangle.bottom)),
    }
  }

  const outer = addGroup('outer', {
    x: 0.35, y: 0.30, size: 0.60, angle: -6, layer: 0,
  })

  const tops = addGroup('top', {
    x: outer.length ? 0.56 : 0.47,
    y: 0.30,
    size: 0.53,
    angle: outer.length ? 5 : -3,
    layer: 40,
  })

  const upper = tops.length ? tops : outer

  // Pantaloni avvicinati al bordo inferiore della parte superiore.
  const upperBottom = upper.length ? boundsOf(upper).bottom : 0.18

  const bottoms = addGroup('bottom', {
    x: 0.43, y: 0.65, size: 0.61, angle: -3, layer: 20,
  })

  if (bottoms.length) {
    const bounds = boundsOf(bottoms)
    const shift = upperBottom - bounds.top - (upper.length ? 0.055 : 0)

    bottoms.forEach((item) => {
      item.position_y += shift
    })
  }

  const shoes = addGroup('shoes', {
    x: 0.76, y: 0.80, size: 0.26, angle: 0, layer: 60,
  })

  if (shoes.length && bottoms.length) {
    const bottomBounds = boundsOf(bottoms)
    const shoeBounds = boundsOf(shoes)

    const shiftX = bottomBounds.right + 0.015 - shoeBounds.left
    const shiftY = bottomBounds.bottom - shoeBounds.bottom

    shoes.forEach((item) => {
      item.position_x += shiftX
      item.position_y += shiftY
    })
  } else if (shoes.length && upper.length) {
    const shoeBounds = boundsOf(shoes)
    const shiftY = upperBottom + 0.025 - shoeBounds.top

    shoes.forEach((item) => {
      item.position_y += shiftY
    })
  }

  addGroup('accessory', {
    x: 0.79, y: 0.43, size: 0.23, angle: 7, layer: 80,
  })

  // Centra e ingrandisce l’intera composizione:
  // il lato più esteso occupa l’88% del riquadro.
  const bounds = boundsOf(result)
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2

  let factor = 0.88 / Math.max(
    bounds.right - bounds.left,
    bounds.bottom - bounds.top,
    0.001,
  )

  // Rispetta i limiti delle trasformazioni già usate dall’app.
  for (const item of result) {
    factor = Math.min(factor, 2 / item.scale)

    for (const distance of [
      item.position_x - centerX,
      item.position_y - centerY,
    ]) {
      if (Math.abs(distance) > 0.00001) {
        factor = Math.min(factor, 0.45 / Math.abs(distance))
      }
    }
  }

  return result.map((item) => {
    const scale = item.scale * factor

    if (scale < 0.05) {
      throw new Error(
        'Una foto ha margini troppo ampi per questa composizione. Prova a sostituirla con una foto più ravvicinata.',
      )
    }

    return {
      ...item,
      position_x: 0.5 + (item.position_x - centerX) * factor,
      position_y: 0.5 + (item.position_y - centerY) * factor,
      scale,
    }
  })
}