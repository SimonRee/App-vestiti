import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  automaticLayout,
  compactAutomaticLayout,
  hydrateItems,
  outfitCategories,
  serializeItems,
} from '../lib/outfits'
import OutfitCanvas from '../components/OutfitCanvas'
import TapButton from '../components/TapButton'
import { MoreOutfits, useOutfitPages } from '../hooks/useOutfitPages'


function ClothesPicker({ category, items, onToggle }) {
  const pager = useOutfitPages('clothes', category)
  const selected = new Set(items.map((item) => item.clothing_id))

  return (
    <>
      <div className="clothes-grid">
        {pager.rows.map((clothing) => (
          <TapButton
            key={clothing.id}
            className={`outfit-grid-button outfit-choice ${
              selected.has(clothing.id) ? 'outfit-choice-selected' : ''
            }`}
            aria-label={`Seleziona ${clothing.category}`}
            aria-pressed={selected.has(clothing.id)}
            onClick={() => onToggle(clothing)}
          >
            <div className="clothing-card-image">
              {clothing.imageUrl ? (
                <img
                  src={clothing.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              ) : (
                <span>Foto non disponibile</span>
              )}
            </div>

            {selected.has(clothing.id) && (
              <span className="outfit-check"><Check size={17} /></span>
            )}
          </TapButton>
        ))}
      </div>

      {!pager.loading && !pager.error && pager.rows.length === 0 && (
        <p>Nessun capo in questa categoria.</p>
      )}

      <MoreOutfits pager={pager} />
    </>
  )
}

function OutfitEditor({ outfit, initialItems = [], userId, onBack, onSaved }) {
  const [items, setItems] = useState([])
  const [mode, setMode] = useState(
  outfit || initialItems.length ? 'compose' : 'select',)
  const [category, setCategory] = useState('')
  const [manual, setManual] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState(null)

  const operation = useRef(false)
  const hasComposition = useRef(
  Boolean(outfit) || initialItems.length > 0,)
  const draftKey = `armarium:outfit:${userId}:${outfit?.id || 'generated'}`
  const selected = items.find((item) => item.clothing_id === selectedId)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        let existing = initialItems

        if (outfit) {
  const { data, error } = await supabase
    .from('outfit_items')
    .select('clothing_id, position_x, position_y, scale, rotation, z_index')
    .eq('outfit_id', outfit.id)
    .order('z_index')

  if (error) throw error
  existing = await hydrateItems(data)
}

        if (cancelled) return
        setItems(existing)

        try {
          const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')

          if (
            saved?.version === 1 &&
            Array.isArray(saved.items) &&
            saved.items.length <= 20
          ) {
            setDraft(saved)
          }
        } catch {
          // Una bozza non leggibile non impedisce di usare l’editor.
        }
      } catch (error) {
        if (!cancelled) setMessage(error.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initialize()
    return () => { cancelled = true }
  }, [outfit, draftKey])

  useEffect(() => {
    if (!dirty || loading || draft) return

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          items: serializeItems(items),
          hasComposition: hasComposition.current,
        }))
      } catch {
        setMessage('Il browser non consente di conservare la bozza. Puoi comunque salvare l’outfit.')
      }
    }, 400)

    return () => window.clearTimeout(timer)
  }, [items, dirty, loading, draft, draftKey])

  useEffect(() => {
    function warn(event) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // Nessun blocco se lo storage locale non è disponibile.
    }
  }

  function replaceItems(next) {
    setItems(next)
    setDirty(true)
    setMessage('')
  }

  function toggleClothing(clothing) {
    if (items.some((item) => item.clothing_id === clothing.id)) {
      replaceItems(items.filter((item) => item.clothing_id !== clothing.id))
      return
    }

    if (items.length >= 20) {
      setMessage('Per ora puoi inserire fino a 20 capi in un outfit.')
      return
    }

    const layouts = automaticLayout([
      ...items.map((item) => item.clothing),
      clothing,
    ])

    // Mantiene le posizioni già modificate.
    replaceItems([...items, layouts[layouts.length - 1]])
  }

  function changeItem(id, patch) {
    setItems((current) => current.map((item) =>
      item.clothing_id === id ? { ...item, ...patch } : item,
    ))
    setDirty(true)
  }

  async function continueToComposition() {
  if (items.length < 2 || operation.current) return

  operation.current = true
  setBusy(true)
  setMessage('')

  try {
    const ready = await hydrateItems(serializeItems(items))

    if (ready.length < 2) {
      setItems(ready)
      setMessage('Servono almeno due capi disponibili. Controlla la selezione.')
      return
    }

    // La prima composizione viene calcolata sull’intera selezione.
    // Quando torni dalla selezione a un outfit già composto,
    // manteniamo invece le posizioni esistenti.
    const next = hasComposition.current
      ? ready
      : await compactAutomaticLayout(ready.map((item) => item.clothing))

    hasComposition.current = true
    setItems(next)
    setDirty(true)
    setSelectedId(null)
    setMode('compose')

    if (ready.length !== items.length) {
      setMessage('Un capo non è più disponibile ed è stato escluso.')
    }
  } catch (error) {
    setMessage(error.message || 'Non è stato possibile preparare l’outfit.')
  } finally {
    setBusy(false)
    operation.current = false
  }
}

async function recompose() {
  if (!items.length || operation.current) return

  if (!window.confirm(
    'Ricalcolare dimensioni e posizioni? Le modifiche manuali saranno sostituite.',
  )) return

  operation.current = true
  setBusy(true)
  setMessage('')

  try {
    // Aggiorna anche gli URL temporanei delle immagini.
    const ready = await hydrateItems(serializeItems(items))

    if (ready.length !== items.length) {
      throw new Error(
        'Un capo non è più disponibile. Controlla prima la selezione.',
      )
    }

    const next = await compactAutomaticLayout(
      ready.map((item) => item.clothing),
    )

    hasComposition.current = true
    replaceItems(next)
    setSelectedId(null)
  } catch (error) {
    setMessage(error.message || 'Composizione non riuscita. Riprova.')
  } finally {
    setBusy(false)
    operation.current = false
  }
}

  async function restoreDraft() {
    if (!draft || operation.current) return
    operation.current = true
    setBusy(true)

    try {
      const ready = await hydrateItems(draft.items)
      setItems(ready)
      setDirty(true)
      // Le vecchie bozze, prive del campo, mantengono la loro disposizione.
hasComposition.current = draft.hasComposition !== false

setMode(
  ready.length >= 2 && hasComposition.current
    ? 'compose'
    : 'select',
)
      setDraft(null)
      setMessage(
        ready.length !== draft.items.length
          ? 'Bozza recuperata. Alcuni capi non sono più disponibili.'
          : 'Bozza recuperata.',
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
      operation.current = false
    }
  }

  function leave() {
    if (busy) return

    if (
      dirty &&
      !window.confirm('Uscire senza salvare? Le modifiche non saranno applicate all’outfit.')
    ) return

    // Conserva esplicitamente la bozza anche se il timer non è ancora partito.
    if (dirty) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          items: serializeItems(items),
          hasComposition: hasComposition.current,
        }))
      } catch {
        // L’uscita rimane possibile.
      }
    }

    onBack()
  }

  function moveLayer(direction) {
    const ordered = [...items].sort((a, b) => a.z_index - b.z_index)
    const index = ordered.findIndex((item) => item.clothing_id === selectedId)
    const target = index + direction

    if (index < 0 || target < 0 || target >= ordered.length) return

    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]

    replaceItems(ordered.map((item, z_index) => ({ ...item, z_index })))
  }

  async function save() {
    if (items.length < 2 || operation.current) return
    operation.current = true
    setBusy(true)
    setMessage('')

    try {
      const { error } = await supabase.rpc('save_outfit', {
        p_outfit_id: outfit?.id || null,
        p_items: serializeItems(items),
      })

      if (error) throw error

      clearDraft()
      setDirty(false)
      onSaved()
    } catch (error) {
      setMessage(error.message || 'Salvataggio non riuscito.')
    } finally {
      setBusy(false)
      operation.current = false
    }
  }

  async function deleteOutfit() {
    if (!outfit || operation.current) return
    if (!window.confirm('Eliminare questo outfit? I capi rimarranno nell’Archivio.')) return

    operation.current = true
    setBusy(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('outfits')
        .delete()
        .eq('id', outfit.id)
        .select('id')

      if (error) throw error
      if (!data.length) throw new Error('Outfit non trovato o non accessibile.')

      clearDraft()
      setDirty(false)
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
      operation.current = false
    }
  }

  return (
    <section className="page outfit-editor">
      <button
        type="button"
        className="profile-back"
        onClick={leave}
        disabled={busy}
        aria-label="Torna all’Armadio"
      >
        <ArrowLeft />
      </button>

      <header className="page-header">
        <p className="page-label">Armadio</p>
        <h1>{outfit ? 'Modifica outfit' : 'Nuovo outfit'}</h1>
      </header>

      {message && <p className="form-message" role="status">{message}</p>}

      {loading ? (
        <p>Caricamento…</p>
      ) : draft ? (
        <div className="outfit-stack">
          <p>Hai una bozza non salvata per questo outfit. Vuoi recuperarla?</p>
          <button
            className="save-clothing-button"
            type="button"
            disabled={busy}
            onClick={restoreDraft}
          >
            Recupera bozza
          </button>
          <button
            className="outfit-secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              clearDraft()
              setDraft(null)
            }}
          >
            Scarta bozza
          </button>
        </div>
      ) : (
        <fieldset className="outfit-editor-fields" disabled={busy}>
          {mode === 'select' ? (
            <>
              <label className="form-field">
                <span>Categoria</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">Tutte le categorie</option>
                  {outfitCategories.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <p>{items.length} capi selezionati · minimo 2</p>

              <ClothesPicker
                key={category}
                category={category}
                items={items}
                onToggle={toggleClothing}
              />

              <div className="outfit-bottom-actions">
                <button
                  type="button"
                  className="save-clothing-button"
                  disabled={items.length < 2 || busy}
                  onClick={continueToComposition}
                >
                  {busy ? 'Preparazione…' : 'Continua'}
                </button>
              </div>
            </>
          ) : (
            <div className="outfit-stack">
              <OutfitCanvas
                items={items}
                editable={manual && !busy}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={changeItem}
              />

              <button
                type="button"
                className="outfit-secondary"
                onClick={() => {
                  setManual(!manual)
                  setSelectedId(null)
                }}
              >
                {manual ? 'Fine modifica disposizione' : 'Modifica disposizione'}
              </button>

              {manual && (
                <>
                  <p className="outfit-hint">
                    Tocca un capo e trascinalo. Scorri la pagina usando lo spazio fuori dai capi.
                  </p>

                  <div className="outfit-layer-list" aria-label="Seleziona un capo">
                    {items.map((item, index) => (
                      <button
                        type="button"
                        key={item.clothing_id}
                        className="outfit-secondary"
                        aria-pressed={selectedId === item.clothing_id}
                        onClick={() => setSelectedId(item.clothing_id)}
                      >
                        {item.clothing?.category || 'Capo'} {index + 1}
                      </button>
                    ))}
                  </div>

                  {selected && (
                    <div className="outfit-controls">
                      <label className="form-field">
                        <span>Dimensione</span>
                        <input
                          type="range"
                          min="0.05"
                          max="2"
                          step="0.01"
                          value={selected.scale}
                          onChange={(event) => changeItem(selectedId, {
                            scale: Number(event.target.value),
                          })}
                        />
                      </label>

                      <label className="form-field">
                        <span>Rotazione: {Math.round(selected.rotation)}°</span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={selected.rotation}
                          onChange={(event) => changeItem(selectedId, {
                            rotation: Number(event.target.value),
                          })}
                        />
                      </label>

                      <div className="outfit-control-row">
                        <button type="button" className="outfit-secondary" onClick={() => moveLayer(-1)}>
                          Indietro
                        </button>
                        <button type="button" className="outfit-secondary" onClick={() => moveLayer(1)}>
                          Davanti
                        </button>
                      </div>

                      <button
                        type="button"
                        className="outfit-secondary"
                        onClick={() => {
                          replaceItems(items.filter((item) => item.clothing_id !== selectedId))
                          setSelectedId(null)
                        }}
                      >
                        Rimuovi dall’outfit
                      </button>
                    </div>
                  )}

                  <button
  type="button"
  className="outfit-secondary"
  onClick={recompose}
  disabled={busy}
>
  {busy ? 'Preparazione…' : 'Composizione automatica'}
</button>
                </>
              )}

              <button
                type="button"
                className="outfit-secondary"
                onClick={() => {
                  setManual(false)
                  setSelectedId(null)
                  setMode('select')
                }}
              >
                Aggiungi o cambia capi
              </button>

              {items.length < 2 && <p>Aggiungi almeno due capi per salvare.</p>}

              <button
                type="button"
                className="save-clothing-button"
                disabled={busy || items.length < 2}
                onClick={save}
              >
                {busy ? 'Attendi…' : 'Salva outfit'}
              </button>

              {outfit && (
                <button
                  type="button"
                  className="delete-clothing-button"
                  onClick={deleteOutfit}
                >
                  Elimina outfit
                </button>
              )}
            </div>
          )}
        </fieldset>
      )}
    </section>
  )
}

export default OutfitEditor