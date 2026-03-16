import { useEffect, useRef } from 'react'
import type { Snip } from '../hooks/useSnips'

export function SnipImage({ snip, className, onSize }: { snip: Snip; className?: string; onSize?: (w: number, h: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const encodedPath = encodeURIComponent(snip.full_path)
    const url = `pdfium://localhost/render?path=${encodedPath}&page=${snip.page}&width=800&dpr=2`
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const sx = Math.round(snip.x * img.naturalWidth)
      const sy = Math.round(snip.y * img.naturalHeight)
      const sw = Math.round(snip.width * img.naturalWidth)
      const sh = Math.round(snip.height * img.naturalHeight)
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      onSize?.(sw, sh)
    }
    img.src = url
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onSize is a stable callback from the parent; including it would re-fetch the image on every render
  }, [snip])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'mt-4 max-h-[60vh] max-w-full rounded border border-[#eee8d5] object-contain dark:border-[#073642]'}
    />
  )
}
