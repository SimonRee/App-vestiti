import { useRef, useState } from 'react'
import { Camera, Shuffle } from 'lucide-react'
import OutfitCanvas from '../components/OutfitCanvas'
import { generateRandomOutfit } from '../lib/outfitGenerator'

function Home({ onCaptureClothing, onOpenGeneratedOutfit }) {
  const [generatedItems, setGeneratedItems] = useState([])
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const previousKey = useRef('')

  async function handleGenerate() {
    if (generating) return

    setGenerating(true)
    setMessage('')

    try {
      const result = await generateRandomOutfit(previousKey.current)

      previousKey.current = result.key
      setGeneratedItems(result.items)
    } catch (error) {
      setMessage(error.message || 'Non è stato possibile generare l’outfit.')
    } finally {
      setGenerating(false)
    }
  }

  function handleCameraChange(event) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (selectedFile) {
      onCaptureClothing(selectedFile)
    }
  }

  return (
    <section className="page home-page">
      <header className="page-header">
        <p className="page-label">Outfit del giorno</p>
        <h1>Gasa?</h1>
      </header>

      <button
        type="button"
        className={`outfit-preview home-outfit-preview ${
          generatedItems.length ? 'home-outfit-preview-active' : ''
        }`}
        onClick={() => {
          if (generatedItems.length) {
            onOpenGeneratedOutfit(generatedItems)
          }
        }}
        disabled={!generatedItems.length}
        aria-label={
          generatedItems.length
            ? 'Apri outfit generato'
            : 'Nessun outfit generato'
        }
      >
        {generatedItems.length ? (
          <OutfitCanvas items={generatedItems} />
        ) : (
          <p>
            {generating
              ? 'Generazione in corso…'
              : 'Genera un outfit per iniziare'}
          </p>
        )}
      </button>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <input
        id="home-camera"
        className="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
      />

      <div className="home-actions">
        <button
          type="button"
          className="generate-outfit-button"
          onClick={handleGenerate}
          disabled={generating}
        >
          <Shuffle size={22} aria-hidden="true" />
          <span>{generating ? 'Generazione…' : 'Genera outfit'}</span>
        </button>

        <label
          className="camera-action"
          htmlFor="home-camera"
          aria-label="Scatta la foto di un capo"
        >
          <Camera />
        </label>
      </div>
    </section>
  )
}

export default Home