import { Camera } from 'lucide-react'

function Home({ onCaptureClothing }) {
  function handleCameraChange(event) {
    const selectedFile = event.target.files?.[0]

    event.target.value = ''

    if (selectedFile) {
      onCaptureClothing(selectedFile)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="page-label">Outfit del giorno</p>
        <h1>Gasa?</h1>
      </header>

      <div className="outfit-preview">
        <p>Nessun outfit salvato</p>
      </div>

      <input
        id="home-camera"
        className="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
      />

      <label
        className="camera-action"
        htmlFor="home-camera"
        aria-label="Scatta la foto di un capo"
      >
        <Camera />
      </label>
    </section>
  )
}

export default Home