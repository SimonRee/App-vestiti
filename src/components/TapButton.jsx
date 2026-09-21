import { useRef } from 'react'

function TapButton({ onClick, children, ...props }) {
  const gesture = useRef(null)

  function trackMovement(event) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return

    if (
      Math.hypot(
        event.clientX - current.x,
        event.clientY - current.y,
      ) > 10 ||
      Math.abs(window.scrollY - current.scrollY) > 2
    ) {
      current.cancelled = true
    }
  }

  return (
    <button
      {...props}
      type="button"
      onPointerDown={(event) => {
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scrollY: window.scrollY,
          cancelled: !event.isPrimary || event.button !== 0,
        }
      }}
      onPointerMove={trackMovement}
      onPointerUp={trackMovement}
      onPointerCancel={() => {
        if (gesture.current) gesture.current.cancelled = true
      }}
      
      onClick={(event) => {
        const cancelled = gesture.current?.cancelled
        gesture.current = null

        // detail === 0 include tastiera e attivazione assistiva.
        if (event.detail !== 0 && cancelled) return
        onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}

export default TapButton