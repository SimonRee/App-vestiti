import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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

function EditClothing({
  clothing,
  onBack,
  onSaved,
  onDeleted,
}) {
  const [category, setCategory] = useState(clothing.category || '')
  const [brand, setBrand] = useState(clothing.brand || '')
  const [color, setColor] = useState(clothing.color || '')
  const [selectedSeasons, setSelectedSeasons] = useState(
    Array.isArray(clothing.seasons) ? clothing.seasons : [],
  )

  const [originalFile, setOriginalFile] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')

  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingError, setProcessingError] = useState('')

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  const previewUrl = localPreviewUrl || clothing.imageUrl

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  function updatePreview(file) {
    setLocalPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return URL.createObjectURL(file)
    })
  }

  function toggleSeason(season) {
    setSelectedSeasons((currentSeasons) => {
      if (currentSeasons.includes(season)) {
        return currentSeasons.filter((item) => item !== season)
      }

      return [...currentSeasons, season]
    })
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
    if (!imageFile) {
      return
    }

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

  async function handleSubmit(event) {
    event.preventDefault()

    if (!category) {
      setMessage('Seleziona una categoria.')
      return
    }

    if (processing) {
      setMessage('Attendi la fine della rimozione dello sfondo.')
      return
    }

    setSaving(true)
    setMessage('')

    let newImagePath = null

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Sessione non valida. Accedi nuovamente.')
      }

      if (processedFile) {
        const extension =
          processedFile.name.split('.').pop()?.toLowerCase() ||
          'webp'

        const fileName = `${crypto.randomUUID()}.${extension}`
        newImagePath = `${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('clothes-images')
          .upload(newImagePath, processedFile, {
            contentType: processedFile.type,
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }
      }

      const updatedClothing = {
        category,
        brand: brand.trim() || null,
        color: color || null,
        seasons: selectedSeasons,
      }

      if (newImagePath) {
        updatedClothing.image_path = newImagePath
      }

      const { error: updateError } = await supabase
        .from('clothes')
        .update(updatedClothing)
        .eq('id', clothing.id)

      if (updateError) {
        if (newImagePath) {
          await supabase.storage
            .from('clothes-images')
            .remove([newImagePath])
        }

        throw updateError
      }

      if (newImagePath) {
        const { error: oldImageError } = await supabase.storage
          .from('clothes-images')
          .remove([clothing.image_path])

        if (oldImageError) {
          console.error(
            'Vecchia immagine non eliminata:',
            oldImageError,
          )
        }
      }

      onSaved()
    } catch (error) {
      setMessage(
        error.message ||
          'Non è stato possibile aggiornare il capo.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Vuoi eliminare definitivamente questo capo?',
    )

    if (!confirmed) {
      return
    }

    setDeleting(true)
    setMessage('')

    try {
      const { error: deleteError } = await supabase
        .from('clothes')
        .delete()
        .eq('id', clothing.id)

      if (deleteError) {
        throw deleteError
      }

      const { error: imageError } = await supabase.storage
        .from('clothes-images')
        .remove([clothing.image_path])

      if (imageError) {
        console.error(
          'Immagine non eliminata dallo storage:',
          imageError,
        )
      }

      onDeleted()
    } catch (error) {
      setMessage(
        error.message ||
          'Non è stato possibile eliminare il capo.',
      )

      setDeleting(false)
    }
  }

  return (
    <main className="page add-clothing-page">
      <button
        className="profile-back"
        type="button"
        onClick={onBack}
        aria-label="Torna all’archivio"
      >
        <ArrowLeft />
      </button>

      <header className="page-header">
        <p className="page-label">Archivio</p>
        <h1>Modifica capo</h1>
      </header>

      <form className="clothing-form" onSubmit={handleSubmit}>
        <div className="photo-field">
          <div className="processing-preview">
            <img
              className="photo-preview"
              src={previewUrl}
              alt=""
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

          {!processing && (
            <>
              <input
                id="edit-clothing-photo"
                className="photo-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              <label
                className="photo-select-button"
                htmlFor="edit-clothing-photo"
              >
                Cambia foto
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

          <select
            value={color}
            onChange={(event) => setColor(event.target.value)}
          >
            <option value="">Seleziona un colore</option>

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
          disabled={saving || deleting || processing}
        >
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>

        <button
          className="delete-clothing-button"
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting || processing}
        >
          {deleting ? 'Eliminazione...' : 'Elimina capo'}
        </button>
      </form>
    </main>
  )
}

export default EditClothing