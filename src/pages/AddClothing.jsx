import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus } from 'lucide-react'
import { removeBackground } from '@imgly/background-removal'
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
  'Altro',
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
  const [previewUrl, setPreviewUrl] = useState('')

  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingError, setProcessingError] = useState('')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState('')
  const [selectedSeasons, setSelectedSeasons] = useState([])
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

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
      const resultBlob = await removeBackground(imageFile, {
        model: 'small',

        output: {
          format: 'image/webp',
          quality: 0.85,
        },

        progress: (_key, current, total) => {
          if (!total) {
            return
          }

          const percentage = Math.round((current / total) * 100)
          setProcessingProgress(percentage)
        },
      })

      const resultFile = new File(
        [resultBlob],
        `${crypto.randomUUID()}.webp`,
        {
          type: 'image/webp',
        },
      )

      setProcessedFile(resultFile)
      updatePreview(resultFile)
    } catch (error) {
      console.error('Errore rimozione sfondo:', error)

      setProcessingError(
        'Non è stato possibile rimuovere lo sfondo.',
      )
    } finally {
      setProcessing(false)
    }
  }

  function useOriginalImage() {
    if (!originalFile) {
      return
    }

    setProcessedFile(originalFile)
    updatePreview(originalFile)
    setProcessingError('')
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

    if (!processedFile) {
      setMessage('Aggiungi e prepara una fotografia del capo.')
      return
    }

    setSaving(true)
    setMessage('')

    let uploadedImagePath = null

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Sessione non valida. Accedi nuovamente.')
      }

      const extension =
        processedFile.name.split('.').pop()?.toLowerCase() ||
        'webp'

      const fileName = `${crypto.randomUUID()}.${extension}`
      uploadedImagePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('clothes-images')
        .upload(uploadedImagePath, processedFile, {
          contentType: processedFile.type,
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      const parsedTags = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

      const { error: insertError } = await supabase
        .from('clothes')
        .insert({
          name: name.trim(),
          category,
          brand: brand.trim() || null,
          color: color.trim() || null,
          seasons: selectedSeasons,
          tags: parsedTags,
          notes: notes.trim() || null,
          image_path: uploadedImagePath,
        })

      if (insertError) {
        await supabase.storage
          .from('clothes-images')
          .remove([uploadedImagePath])

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
              <span>Nome *</span>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Es. Camicia bianca"
                required
              />
            </label>

            <label className="form-field">
              <span>Categoria *</span>

              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              >
                <option value="">Seleziona una categoria</option>

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

              <input
                type="text"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="Es. Blu scuro"
              />
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

            <label className="form-field">
              <span>Tag</span>

              <input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Casual, elegante, preferito"
              />

              <small>Separa i tag con una virgola.</small>
            </label>

            <label className="form-field">
              <span>Note</span>

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Informazioni aggiuntive"
                rows="4"
              />
            </label>

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