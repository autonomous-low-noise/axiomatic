import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

interface Props {
  fullPath: string
  currentPage: number
  totalPages: number
  onClose: () => void
}

export function ClipDialog({ fullPath, currentPage, totalPages, onClose }: Props) {
  const [startPage, setStartPage] = useState(currentPage)
  const [endPage, setEndPage] = useState(currentPage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClip = useCallback(async () => {
    setError(null)
    const outputPath = await save({
      defaultPath: `clip_p${startPage}-${endPage}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!outputPath) return

    setSaving(true)
    try {
      await invoke('clip_pdf', {
        sourcePath: fullPath,
        startPage,
        endPage,
        outputPath,
      })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }, [fullPath, startPage, endPage, onClose])

  const pageCount = endPage - startPage + 1
  const valid = startPage >= 1 && endPage >= startPage && endPage <= totalPages

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-80 rounded-lg bg-[#fdf6e3] p-4 shadow-lg dark:bg-[#002b36]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-[#073642] dark:text-[#eee8d5]">
          Clip Pages
        </h2>
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-[#586e75] dark:text-[#93a1a1]">From</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={startPage}
            onChange={(e) => setStartPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))}
            className="w-20 rounded border border-[#93a1a1] bg-[#fdf6e3] px-2 py-1 text-sm text-[#073642] dark:border-[#586e75] dark:bg-[#073642] dark:text-[#eee8d5]"
          />
          <label className="text-xs text-[#586e75] dark:text-[#93a1a1]">to</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={endPage}
            onChange={(e) => setEndPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))}
            className="w-20 rounded border border-[#93a1a1] bg-[#fdf6e3] px-2 py-1 text-sm text-[#073642] dark:border-[#586e75] dark:bg-[#073642] dark:text-[#eee8d5]"
          />
        </div>
        <p className="mb-3 text-xs text-[#93a1a1] dark:text-[#657b83]">
          {valid ? `${pageCount} page${pageCount !== 1 ? 's' : ''} will be extracted` : 'Invalid page range'}
        </p>
        {error && (
          <p className="mb-2 text-xs text-[#dc322f]">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-sm text-[#586e75] hover:bg-[#eee8d5] dark:text-[#93a1a1] dark:hover:bg-[#073642]"
          >
            Cancel
          </button>
          <button
            onClick={handleClip}
            disabled={!valid || saving}
            className="rounded bg-[#268bd2] px-3 py-1 text-sm text-white hover:bg-[#268bd2]/80 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
