import { useRef } from 'react'

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value))

function OutfitCanvas({
  items,
  editable = false,
  selectedId = null,
  onSelect,
  onChange,
}) {
  const canvasRef = useRef(null)
  const drag = useRef(null)

  function startDrag(event, item) {
    if (!editable || !event.isPrimary || event.button !== 0) return

    event.stopPropagation()
    onSelect(item.clothing_id)

    const bounds = canvasRef.current.getBoundingClientRect()

    drag.current = {
      pointerId: event.pointerId,
      id: item.clothing_id,
      startX: event.clientX,
      startY: event.clientY,
      x: Number(item.position_x),
      y: Number(item.position_y),
      width: bounds.width,
      height: bounds.height,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return

    onChange(current.id, {
      position_x: clamp(
        current.x + (event.clientX - current.startX) / current.width,
        0.05,
        0.95,
      ),
      position_y: clamp(
        current.y + (event.clientY - current.startY) / current.height,
        0.05,
        0.95,
      ),
    })
  }

  function finishDrag(event) {
    if (drag.current?.pointerId !== event.pointerId) return

    drag.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={canvasRef}
      className="outfit-canvas"
      onClick={() => editable && onSelect(null)}
    >
      {items.map((item) => {
        const style = {
          left: `${Number(item.position_x) * 100}%`,
          top: `${Number(item.position_y) * 100}%`,
          width: `${Number(item.scale) * 100}%`,
          height: `${Number(item.scale) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
          zIndex: Number(item.z_index),
        }

        const picture = item.clothing?.imageUrl ? (
          <img
            src={item.clothing.imageUrl}
            alt=""
            draggable={false}
            loading={editable ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <span className="outfit-missing-image">Foto non disponibile</span>
        )

        if (!editable) {
          return (
            <div className="outfit-piece" style={style} key={item.clothing_id}>
              {picture}
            </div>
          )
        }

        return (
          <button
            key={item.clothing_id}
            type="button"
            className={`outfit-piece outfit-piece-editable ${
              selectedId === item.clothing_id ? 'outfit-piece-selected' : ''
            }`}
            style={style}
            aria-label={`Seleziona ${item.clothing?.category || 'capo'}`}
            aria-pressed={selectedId === item.clothing_id}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(item.clothing_id)
            }}
            onPointerDown={(event) => startDrag(event, item)}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onLostPointerCapture={() => { drag.current = null }}
          >
            {picture}
          </button>
        )
      })}
    </div>
  )
}

export default OutfitCanvas