import { removeBackground } from '@imgly/background-removal'

const MAIN_MAX_DIMENSION = 1600
const MAIN_MAX_BYTES = 1024 * 1024

const THUMBNAIL_MAX_DIMENSION = 400
const THUMBNAIL_MAX_BYTES = 150 * 1024

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(source)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Non è stato possibile leggere l’immagine.'))
    }

    image.src = url
  })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Non è stato possibile comprimere l’immagine.'))
        }
      },
      'image/webp',
      quality,
    )
  })
}

function calculateSize(width, height, maxDimension) {
  const ratio = Math.min(1, maxDimension / Math.max(width, height))

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function createImageFile(blob, fileName) {
  // Alcuni browser producono PNG quando l’esportazione WebP
  // non è disponibile. Manteniamo il formato effettivo.
  const extension = blob.type === 'image/png' ? 'png' : 'webp'
  const baseName = fileName.replace(/\.[^.]+$/, '')

  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
  })
}

export async function createOptimizedWebp(
  source,
  {
    maxDimension,
    initialQuality,
    maxBytes,
    fileName = `${crypto.randomUUID()}.webp`,
  },
) {
  const image = await loadImage(source)

  let { width, height } = calculateSize(
    image.naturalWidth,
    image.naturalHeight,
    maxDimension,
  )

  let quality = initialQuality

  const canvas = document.createElement('canvas')

  for (let attempt = 0; attempt < 20; attempt += 1) {
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Non è stato possibile preparare l’immagine.')
    }

    // Ridimensiona l’intera foto, senza ritagliarla o spostarla.
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, quality)

    if (!maxBytes || blob.size <= maxBytes) {
      return createImageFile(blob, fileName)
    }

    if (blob.type === 'image/webp' && quality > 0.56) {
      quality = Math.max(0.56, quality - 0.08)
    } else {
      width = Math.max(1, Math.round(width * 0.85))
      height = Math.max(1, Math.round(height * 0.85))
      quality = 0.76
    }
  }

  throw new Error(
    'Non è stato possibile ridurre la foto al peso previsto. Prova con un’altra immagine.',
  )
}

async function createVariants(source) {
  const id = crypto.randomUUID()

  const mainFile = await createOptimizedWebp(source, {
    maxDimension: MAIN_MAX_DIMENSION,
    initialQuality: 0.82,
    maxBytes: MAIN_MAX_BYTES,
    fileName: `${id}.webp`,
  })

  const thumbnailFile = await createOptimizedWebp(mainFile, {
    maxDimension: THUMBNAIL_MAX_DIMENSION,
    initialQuality: 0.7,
    maxBytes: THUMBNAIL_MAX_BYTES,
    fileName: `${id}.webp`,
  })

  return {
    mainFile,
    thumbnailFile,
  }
}

export async function removeBackgroundAndOptimize(
  imageFile,
  onProgress,
) {
  const resizedInput = await createOptimizedWebp(imageFile, {
    maxDimension: MAIN_MAX_DIMENSION,
    initialQuality: 0.88,
    maxBytes: 1.5 * 1024 * 1024,
    fileName: `input-${crypto.randomUUID()}.webp`,
  })

  const resultBlob = await removeBackground(resizedInput, {
    model: 'small',

    output: {
      format: 'image/webp',
      quality: 0.85,
    },

    progress: (_key, current, total) => {
      if (!total || !onProgress) return

      onProgress(Math.round((current / total) * 100))
    },
  })

  return createVariants(resultBlob)
}

export async function optimizeWithoutBackgroundRemoval(imageFile) {
  return createVariants(imageFile)
}