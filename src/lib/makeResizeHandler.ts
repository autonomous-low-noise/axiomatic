export function makeResizeHandler(
  setter: (w: number) => void,
  min: number,
  max: number,
  side: 'left' | 'right',
) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    let rafId = 0
    let latestRaw = 0

    const onMouseMove = (ev: globalThis.MouseEvent) => {
      latestRaw = side === 'left' ? ev.clientX : window.innerWidth - ev.clientX
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          setter(Math.min(max, Math.max(min, latestRaw)))
        })
      }
    }
    const onMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
}
