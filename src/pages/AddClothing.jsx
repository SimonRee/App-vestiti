import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus } from 'lucide-react'
import {
  optimizeWithoutBackgroundRemoval,
  removeBackgroundAndOptimize,
} from '../utils/imageOptimization'
import { supabase } from '../lib/supabase'

const categories = [
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

const colors = [
  'Nero',
  'Bianco',
  'Grigio',
  'Blu',
  'Azzurro',
  'Rosso',
  'Verde',
  'Marrone',
  'Beige',
  'Giallo',
  'Arancione',
  'Viola',
  'Rosa',
  'Multicolore',
]

const seasons = [
  'Primavera',
  'Estate',
  'Autunno',
  'Inverno',
]

function AddClothing({ initialFile, onBack, onSaved }) {
  const initialFileHandled = useRef(false)

  const [originalFile, setOriginalFile] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingError, setProcessingError] = useState('')

  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState('')
  const [selectedSeasons, setSelectedSeasons] = useState([])

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!initialFile || initialFileHandled.current) {
      return
    }

    initialFileHandled.current = true

    if (!initialFile.type.startsWith('image/')) {
      setMessage('Il file acquisito non è un’immagine valida.')
      return
    }

    if (initialFile.size > 10 * 1024 * 1024) {
      setMessage('L’immagine non può superare 10 MB.')
      return
    }

    setOriginalFile(initialFile)
    updatePreview(initialFile)
    processImage(initialFile)
  }, [initialFile])

  function updatePreview(file) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]

    event.target.value = ''

    if (!selectedFile) {
      return
    }

    if (!selectedFile.type.startsWith('image/')) {
      setMessage('Seleziona un file immagine.')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setMessage('L’immagine non può superare 10 MB.')
      return
    }

    setOriginalFile(selectedFile)
    setProcessedFile(null)
    setThumbnailFile(null)
    setMessage('')
    setProcessingError('')
    updatePreview(selectedFile)

    await processImage(selectedFile)
  }

  async function processImage(imageFile) {
  setProcessing(true)
  setProcessingProgress(0)
  setProcessingError('')

  try {
    const {
      mainFile,
      thumbnailFile: newThumbnailFile,
    } = await removeBackgroundAndOptimize(
      imageFile,
      setProcessingProgress,
    )

    setProcessedFile(mainFile)
    setThumbnailFile(newThumbnailFile)
    updatePreview(mainFile)
  } catch (error) {
    console.error('Errore rimozione sfondo:', error)

    setProcessingError(
      'Non è stato possibile rimuovere lo sfondo.',
    )
  } finally {
    setProcessing(false)
  }
}

  async function useOriginalImage() {
  if (!originalFile) {
    return
  }

  setProcessing(true)
  setProcessingError('')

  try {
    const {
      mainFile,
      thumbnailFile: newThumbnailFile,
    } = await optimizeWithoutBackgroundRemoval(originalFile)

    setProcessedFile(mainFile)
    setThumbnailFile(newThumbnailFile)
    updatePreview(mainFile)
  } catch (error) {
    console.error('Errore ottimizzazione immagine:', error)

    setProcessingError(
      'Non è stato possibile preparare l’immagine.',
    )
  } finally {
    setProcessing(false)
  }
}

  function toggleSeason(season) {
    setSelectedSeasons((currentSeasons) => {
      if (currentSeasons.includes(season)) {
        return currentSeasons.filter((item) => item !== season)
      }

      return [...currentSeasons, season]
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!processedFile || !thumbnailFile) {
      setMessage('Aggiungi e prepara una fotografia del capo.')
      return
    }

    if (!category) {
      setMessage('Seleziona una categoria.')
      return
    }

    setSaving(true)
    setMessage('')

    let uploadedImagePath = null
    let uploadedThumbnailPath = null

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Sessione non valida. Accedi nuovamente.')
      }

      const fileId = crypto.randomUUID()

uploadedImagePath =
  `${user.id}/originals/${fileId}.webp`

uploadedThumbnailPath =
  `${user.id}/thumbnails/${fileId}.webp`

const { error: mainUploadError } = await supabase.storage
  .from('clothes-images')
  .upload(uploadedImagePath, processedFile, {
    contentType: 'image/webp',
    upsert: false,
  })

if (mainUploadError) {
  throw mainUploadError
}

const { error: thumbnailUploadError } = await supabase.storage
  .from('clothes-images')
  .upload(uploadedThumbnailPath, thumbnailFile, {
    contentType: 'image/webp',
    upsert: false,
  })

if (thumbnailUploadError) {
  await supabase.storage
    .from('clothes-images')
    .remove([uploadedImagePath])

  throw thumbnailUploadError
}

const { error: insertError } = await supabase
  .from('clothes')
  .insert({
    category,
    brand: brand.trim() || null,
    color: color || null,
    seasons: selectedSeasons,
    image_path: uploadedImagePath,
    thumbnail_path: uploadedThumbnailPath,
  })

if (insertError) {
  await supabase.storage
    .from('clothes-images')
    .remove([
      uploadedImagePath,
      uploadedThumbnailPath,
    ])

  throw insertError
}

      onSaved()
    } catch (error) {
      setMessage(
        error.message || 'Non è stato possibile salvare il capo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page add-clothing-page">
      <button
        className="profile-back"
        type="button"
        onClick={onBack}
        aria-label="Torna indietro"
      >
        <ArrowLeft />
      </button>

      <header className="page-header">
        <p className="page-label">Nuovo elemento</p>
        <h1>Aggiungi capo</h1>
      </header>

      <form className="clothing-form" onSubmit={handleSubmit}>
        <div className="photo-field">
          {previewUrl ? (
            <div className="processing-preview">
              <img
                className="photo-preview"
                src={previewUrl}
                alt="Anteprima del capo"
              />

              {processing && (
                <div className="processing-overlay">
                  <div className="processing-spinner" />

                  <strong>Rimozione dello sfondo…</strong>

                  {processingProgress > 0 &&
                    processingProgress < 100 && (
                      <span>
                        Preparazione AI: {processingProgress}%
                      </span>
                    )}
                </div>
              )}
            </div>
          ) : (
            <div className="photo-placeholder">
              <ImagePlus />
              <span>Nessuna immagine selezionata</span>
            </div>
          )}

          {!processing && (
            <>
              <input
                id="clothing-photo"
                className="photo-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              <label
                className="photo-select-button"
                htmlFor="clothing-photo"
              >
                {originalFile
                  ? 'Cambia foto'
                  : 'Scatta o scegli una foto'}
              </label>
            </>
          )}
        </div>

        {processingError && (
          <div className="processing-error">
            <p>{processingError}</p>

            <div className="processing-error-actions">
              <button
                type="button"
                onClick={() => processImage(originalFile)}
              >
                Riprova
              </button>

              <button
                type="button"
                onClick={useOriginalImage}
              >
                Usa originale
              </button>
            </div>
          </div>
        )}

        {!processing && processedFile && (
          <>
            <p className="processing-success">
              Sfondo rimosso. L’immagine è pronta.
            </p>

            <label className="form-field">
              <span>Categoria *</span>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              >
                <option value="">
                  Seleziona una categoria
                </option>

                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Brand</span>

              <input
                type="text"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Es. Levi’s"
              />
            </label>

            <label className="form-field">
              <span>Colore</span>

              <select
                value={color}
                onChange={(event) => setColor(event.target.value)}
              >
                <option value="">
                  Seleziona un colore
                </option>

                {colors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="season-field">
              <legend>Stagione</legend>

              <div className="season-options">
                {seasons.map((season) => (
                  <label
                    className={`season-option ${
                      selectedSeasons.includes(season)
                        ? 'season-option-selected'
                        : ''
                    }`}
                    key={season}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSeasons.includes(season)}
                      onChange={() => toggleSeason(season)}
                    />

                    {season}
                  </label>
                ))}
              </div>
            </fieldset>

            {message && (
              <p className="form-message">
                {message}
              </p>
            )}

            <button
              className="save-clothing-button"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Salvataggio...' : 'Salva capo'}
            </button>
          </>
        )}
      </form>
    </main>
  )
}

export default AddClothing