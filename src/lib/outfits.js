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

// REGOLE DI BASE
//
// size: dimensione del quadrato che contiene la foto.
// angle: rotazione in gradi.
// layer: un valore maggiore porta il capo più avanti.
//
// Le posizioni e gli adattamenti ai gruppi presenti
// sono definiti nella funzione automaticLayout.
const LAYOUT_RULES = {
  outer: {
    size: 0.96,
    angle: -8,
    layer: 0,
  },

  middle: {
    size: 0.90,
    angle: -8,
    layer: 200,
  },

  top: {
    size: 0.90,
    angle: 8,
    layer: 300,
  },

  bottom: {
    size: 0.96,
    angle: -7,
    layer: 100,
  },

  shoes: {
    size: 0.50,
    angle: 5,
    layer: 400,
  },

  accessory: {
    size: 0.36,
    angle: 10,
    layer: 500,
  },
}

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
    return clothes.map((item) => ({
      ...item,
      imageUrl: null,
    }))
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

// ASSEGNAZIONE DELLE CATEGORIE AI GRUPPI
function groupOf(category) {
  if (['Giacca', 'Cappotto'].includes(category)) {
    return 'outer'
  }

  if (['Felpa', 'Maglione'].includes(category)) {
    return 'middle'
  }

  if (['Pantaloni', 'Jeans', 'Shorts'].includes(category)) {
    return 'bottom'
  }

  if (category === 'Scarpe') return 'shoes'
  if (category === 'Accessorio') return 'accessory'

  return 'top'
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function automaticLayout(clothes) {
  if (!clothes.length) return []

  const groups = Object.fromEntries(
    Object.keys(LAYOUT_RULES).map((key) => [key, []]),
  )

  clothes.forEach((clothing) => {
    groups[groupOf(clothing.category)].push(clothing)
  })

  const upperGroups = ['outer', 'middle', 'top'].filter(
    (key) => groups[key].length > 0,
  )

  const activeGroups = Object.keys(groups).filter(
    (key) => groups[key].length > 0,
  )

  const hasUpper = upperGroups.length > 0
  const hasBottom = groups.bottom.length > 0
  const hasShoes = groups.shoes.length > 0
  const hasAccessory = groups.accessory.length > 0

  // POSIZIONI DI BASE
  //
  // x: da sinistra (0) a destra (1).
  // y: dall’alto (0) al basso (1).
  //
  // Si riferiscono al centro della foto, non al capo visibile.
  const anchors = {
    outer: {
      x: 0.35,
      y: 0.35,
    },

    middle: {
      x: 0.43,
      y: 0.34,
    },

    top: {
      x: 0.58,
      y: 0.31,
    },

    bottom: {
      x: hasShoes || hasAccessory ? 0.34 : 0.42,
      y: 0.65,
    },

    shoes: {
      x: 0.75,
      y: 0.73,
    },

    accessory: {
      x: 0.79,
      y: 0.43,
    },
  }

  const sizes = Object.fromEntries(
    Object.entries(LAYOUT_RULES).map(([key, rule]) => [
      key,
      rule.size,
    ]),
  )

  // PIÙ STRATI SUPERIORI
  //
  // Da sinistra a destra:
  // capospalla → felpa/maglione → T-shirt/camicia.
  //
  // Se manca un gruppo, gli altri occupano le posizioni disponibili.
  if (upperGroups.length > 1) {
    const positions = upperGroups.length === 2
      ? [0.35, 0.61]
      : [0.29, 0.45, 0.64]

    upperGroups.forEach((key, index) => {
      anchors[key].x = positions[index]

      // Riduzione moderata per lasciare leggibili più strati.
      sizes[key] *= upperGroups.length === 3 ? 0.90 : 0.96
    })
  }

  // SENZA PANTALONI
  //
  // La parte superiore scende verso il centro.
  if (!hasBottom && hasUpper) {
    upperGroups.forEach((key) => {
      anchors[key].y += hasShoes ? 0.06 : 0.13
    })

    anchors.shoes = {
      x: 0.66,
      y: 0.73,
    }

    if (upperGroups.length === 1) {
      anchors[upperGroups[0]].x = hasAccessory ? 0.43 : 0.48
    }
  }

  // SENZA PARTE SUPERIORE
  //
  // I pantaloni salgono e diventano il centro della composizione.
  if (!hasUpper && hasBottom) {
    anchors.bottom = {
      x: hasShoes || hasAccessory ? 0.40 : 0.50,
      y: 0.49,
    }

    anchors.shoes = {
      x: 0.73,
      y: 0.65,
    }

    anchors.accessory = {
      x: 0.73,
      y: 0.31,
    }
  }

  // SOLO SCARPE E ACCESSORI
  if (!hasUpper && !hasBottom && hasShoes && hasAccessory) {
    anchors.shoes = {
      x: 0.35,
      y: 0.53,
    }

    anchors.accessory = {
      x: 0.68,
      y: 0.47,
    }

    sizes.shoes = 0.65
    sizes.accessory = 0.48
  }

  // UN SOLO GRUPPO PRESENTE
  //
  // Il gruppo viene centrato.
  // Può comunque contenere più capi.
  if (activeGroups.length === 1) {
    const key = activeGroups[0]

    anchors[key] = {
      x: 0.50,
      y: 0.50,
    }

    if (key === 'shoes') sizes.shoes = 0.68
    if (key === 'accessory') sizes.accessory = 0.58
  }

  const placements = new Map()

  activeGroups.forEach((key) => {
    // Ordine stabile anche se cambia l’ordine della selezione.
    const ordered = [...groups[key]].sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    )

    const count = ordered.length
    const columns = Math.min(count, 3)
    const rows = Math.ceil(count / columns)

    ordered.forEach((clothing, index) => {
      const row = Math.floor(index / columns)
      const inRow = Math.min(columns, count - row * columns)
      const column = index % columns

      // Più spazio tra i capi se occupano da soli la composizione.
      const spread = activeGroups.length === 1 ? 0.27 : 0.14
      const verticalSpread = activeGroups.length === 1 ? 0.16 : 0.09

      const offsetX = (column - (inRow - 1) / 2) * spread
      const offsetY = (row - (rows - 1) / 2) * verticalSpread

      // Piccola alternanza, senza rotazioni estreme.
      const variation = count > 1
        ? (index % 2 === 0 ? -3 : 3)
        : 0

      // Più capi nello stesso gruppo: dimensione un po’ ridotta.
      const reduction = Math.max(
        0.68,
        1 - (count - 1) * 0.06,
      )

      placements.set(clothing.id, {
        // Limiti applicati soltanto al centro.
        // Il quadrato della foto può oltrepassare il bordo.
        position_x: clamp(
          anchors[key].x + offsetX,
          0.05,
          0.95,
        ),

        position_y: clamp(
          anchors[key].y + offsetY,
          0.05,
          0.95,
        ),

        scale: sizes[key] * reduction,
        rotation: LAYOUT_RULES[key].angle + variation,
        z_index: LAYOUT_RULES[key].layer + index,
      })
    })
  })

  // Mantiene l’ordine atteso dall’editor quando aggiunge un capo.
  return clothes.map((clothing) => ({
    clothing_id: clothing.id,
    clothing,
    ...placements.get(clothing.id),
  }))
}

// Compatibilità con le chiamate già presenti nell’editor.
export async function compactAutomaticLayout(clothes) {
  return automaticLayout(clothes)
}