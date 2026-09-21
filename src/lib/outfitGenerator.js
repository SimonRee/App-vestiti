import { supabase } from './supabase'
import { attachImages, automaticLayout } from './outfits'

const OPTIONAL_PROBABILITY = 0.5

const BOTTOM_CATEGORIES = [
  'Pantaloni',
  'Jeans',
  'Shorts',
]

function randomItem(items) {
  if (!items.length) return null

  return items[Math.floor(Math.random() * items.length)]
}

function combinationKey(items) {
  return items
    .map((item) => item.id)
    .sort()
    .join('|')
}

function chooseExclusiveGroup(firstGroup, secondGroup) {
  if (!firstGroup.length && !secondGroup.length) {
    return null
  }

  if (!firstGroup.length) {
    return randomItem(secondGroup)
  }

  if (!secondGroup.length) {
    return randomItem(firstGroup)
  }

  return Math.random() < 0.5
    ? randomItem(firstGroup)
    : randomItem(secondGroup)
}

function createSelection(data) {
  const tShirts = data.filter(
    (item) => item.category === 'T-shirt',
  )

  const shirts = data.filter(
    (item) => item.category === 'Camicia',
  )

  const sweatshirts = data.filter(
    (item) => item.category === 'Felpa',
  )

  const sweaters = data.filter(
    (item) => item.category === 'Maglione',
  )

  const jackets = data.filter(
    (item) => item.category === 'Giacca',
  )

  const coats = data.filter(
    (item) => item.category === 'Cappotto',
  )

  const bottoms = data.filter((item) =>
    BOTTOM_CATEGORIES.includes(item.category),
  )

  const shoes = data.filter(
    (item) => item.category === 'Scarpe',
  )

  const accessories = data.filter(
    (item) => item.category === 'Accessorio',
  )

  const selected = []

  // La T-shirt è sempre obbligatoria.
  const tShirt = randomItem(tShirts)

  if (!tShirt) {
    throw new Error(
      'Aggiungi almeno una T-shirt all’Archivio.',
    )
  }

  selected.push(tShirt)

  // La camicia è opzionale.
  if (
    shirts.length &&
    Math.random() < OPTIONAL_PROBABILITY
  ) {
    selected.push(randomItem(shirts))
  }

  // Felpa e maglione sono esclusivi:
  // può uscire al massimo uno dei due.
  if (
    (sweatshirts.length || sweaters.length) &&
    Math.random() < OPTIONAL_PROBABILITY
  ) {
    selected.push(
      chooseExclusiveGroup(sweatshirts, sweaters),
    )
  }

  // Giacca e cappotto sono esclusivi:
  // può uscire al massimo uno dei due.
  if (
    (jackets.length || coats.length) &&
    Math.random() < OPTIONAL_PROBABILITY
  ) {
    selected.push(
      chooseExclusiveGroup(jackets, coats),
    )
  }

  // Massimo un capo inferiore.
  if (bottoms.length) {
    selected.push(randomItem(bottoms))
  }

  // Massimo un paio di scarpe.
  if (shoes.length) {
    selected.push(randomItem(shoes))
  }

  // L’accessorio è opzionale.
  if (
    accessories.length &&
    Math.random() < OPTIONAL_PROBABILITY
  ) {
    selected.push(randomItem(accessories))
  }

  return selected.filter(Boolean)
}

export async function generateRandomOutfit(previousKey = '') {
  const { data, error } = await supabase
    .from('clothes')
    .select(
      'id, category, image_path, thumbnail_path, brand, color, seasons',
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  if (!data?.length) {
    throw new Error(
      'Aggiungi almeno due capi all’Archivio.',
    )
  }

  const availableTShirts = data.filter(
    (item) => item.category === 'T-shirt',
  )

  if (!availableTShirts.length) {
    throw new Error(
      'Aggiungi almeno una T-shirt all’Archivio.',
    )
  }

  let selected = createSelection(data)
  let key = combinationKey(selected)

  // Prova a evitare la stessa combinazione consecutiva.
  // Ricrea l’outfit rispettando sempre tutte le regole.
  if (key === previousKey) {
    for (
      let attempt = 0;
      attempt < 12 && key === previousKey;
      attempt += 1
    ) {
      const alternative = createSelection(data)
      const alternativeKey = combinationKey(alternative)

      if (alternativeKey !== previousKey) {
        selected = alternative
        key = alternativeKey
      }
    }
  }

  if (selected.length < 2) {
    throw new Error(
      'Servono almeno due categorie di capi nell’Archivio.',
    )
  }

  const withImages = await attachImages(selected, true)
  const items = automaticLayout(withImages)

  return {
    key,
    items,
  }
}