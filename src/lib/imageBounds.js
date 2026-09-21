export function readAlphaBounds(image, maxDimension = 512) {
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  const ratio = Math.min(
    1,
    maxDimension / Math.max(originalWidth, originalHeight),
  )

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(originalWidth * ratio))
  canvas.height = Math.max(1, Math.round(originalHeight * ratio))

  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('Non è stato possibile analizzare l’immagine.')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const { data } = context.getImageData(
    0, 0, canvas.width, canvas.height,
  )

  let left = canvas.width
  let top = canvas.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3]

      if (alpha === 0) continue

      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) {
    throw new Error('L’immagine è completamente trasparente.')
  }

  // Un piccolo margine protegge bordi morbidi e antialiasing.
  const padding = Math.max(
    1,
    Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 0.02),
  )

  const x = Math.max(
    0,
    Math.floor((left - padding) * originalWidth / canvas.width),
  )
  const y = Math.max(
    0,
    Math.floor((top - padding) * originalHeight / canvas.height),
  )
  const endX = Math.min(
    originalWidth,
    Math.ceil((right + 1 + padding) * originalWidth / canvas.width),
  )
  const endY = Math.min(
    originalHeight,
    Math.ceil((bottom + 1 + padding) * originalHeight / canvas.height),
  )

  return { x, y, width: endX - x, height: endY - y }
}

export async function measureClothingImage(url) {
  if (!url) {
    throw new Error('La foto di un capo non è disponibile.')
  }

  const image = await new Promise((resolve, reject) => {
    const candidate = new Image()

    const timer = window.setTimeout(() => {
      candidate.onload = null
      candidate.onerror = null
      candidate.src = ''
      reject(new Error('Caricamento delle foto troppo lento. Riprova.'))
    }, 20000)

    candidate.crossOrigin = 'anonymous'

    candidate.onload = () => {
      window.clearTimeout(timer)
      resolve(candidate)
    }

    candidate.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Non è stato possibile caricare una foto. Riprova.'))
    }

    candidate.src = url
  })

  const bounds = readAlphaBounds(image)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)

  // Coordinate riferite al quadrato usato da OutfitCanvas,
  // tenendo conto di object-fit: contain.
  return {
    width: bounds.width / longestSide,
    height: bounds.height / longestSide,
    offsetX:
      (bounds.x + bounds.width / 2 - image.naturalWidth / 2) / longestSide,
    offsetY:
      (bounds.y + bounds.height / 2 - image.naturalHeight / 2) / longestSide,
  }
}