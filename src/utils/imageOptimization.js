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
          reject(
            new Error('Non è stato possibile comprimere l’immagine.'),
          )
        }
      },
      'image/webp',
      quality,
    )
  })
}

function calculateSize(width, height, maxDimension) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }

  const scale = maxDimension / Math.max(width, height)

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
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
  let lastBlob = null

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = width
    canvas.height = height

    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    lastBlob = await canvasToBlob(canvas, quality)

    if (!maxBytes || lastBlob.size <= maxBytes) {
      return new File([lastBlob], fileName, {
        type: 'image/webp',
      })
    }

    if (quality > 0.54) {
      quality -= 0.08
    } else {
      width = Math.round(width * 0.85)
      height = Math.round(height * 0.85)
      quality = 0.7
    }
  }

  return new File([lastBlob], fileName, {
    type: 'image/webp',
  })
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
      if (!total || !onProgress) {
        return
      }

      onProgress(Math.round((current / total) * 100))
    },
  })

  return createVariants(resultBlob)
}

export async function optimizeWithoutBackgroundRemoval(imageFile) {
  return createVariants(imageFile)
}