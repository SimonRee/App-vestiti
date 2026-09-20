import { useEffect, useState } from 'react'
import { ArrowLeft, ImagePlus } from 'lucide-react'
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

function AddClothing({ onBack, onSaved }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState('')
  const [selectedSeasons, setSelectedSeasons] = useState([])
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]

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

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
    setMessage('')
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

    if (!file) {
      setMessage('Aggiungi una fotografia del capo.')
      return
    }

    setLoading(true)
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

      const originalExtension =
        file.name.split('.').pop()?.toLowerCase() || 'jpg'

      const fileName = `${crypto.randomUUID()}.${originalExtension}`
      uploadedImagePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('clothes-images')
        .upload(uploadedImagePath, file, {
          contentType: file.type,
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
      setMessage(error.message || 'Non è stato possibile salvare il capo.')
    } finally {
      setLoading(false)
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
            <img
              className="photo-preview"
              src={previewUrl}
              alt="Anteprima del capo"
            />
          ) : (
            <div className="photo-placeholder">
              <ImagePlus />
              <span>Nessuna immagine selezionata</span>
            </div>
          )}

          <label className="photo-select-button">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />

            {file ? 'Cambia foto' : 'Scatta o scegli una foto'}
          </label>
        </div>

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
          disabled={loading}
        >
          {loading ? 'Salvataggio...' : 'Salva capo'}
        </button>
      </form>
    </main>
  )
}

export default AddClothing