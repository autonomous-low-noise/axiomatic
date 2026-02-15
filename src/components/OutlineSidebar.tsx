import { useEffect, useRef, useState } from 'react'
import type { DocumentInfo } from '../hooks/useDocument'

interface Props {
  docInfo: DocumentInfo
  fullPath: string
  currentPage: number
  onNavigate: (page: number) => void
}

function PageTile({
  pageNum,
  fullPath,
  aspectRatio,
  isCurrent,
  onNavigate,
}: {
  pageNum: number
  fullPath: string
  aspectRatio: number
  isCurrent: boolean
  onNavigate: (page: number) => void
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tileWidth = 120
  const tileHeight = tileWidth / aspectRatio
  const encodedPath = encodeURIComponent(fullPath)

  return (
    <button
      ref={ref}
      onClick={() => onNavigate(pageNum)}
      className={`group relative block shrink-0 rounded ${
        isCurrent
          ? 'ring-2 ring-[#268bd2]'
          : 'ring-1 ring-[#93a1a1]/30 dark:ring-[#586e75]/30'
      }`}
      style={{ width: tileWidth, height: tileHeight }}
    >
      {visible ? (
        <img
          src={`pdfium://localhost/render?path=${encodedPath}&page=${pageNum}&width=${tileWidth}&dpr=1`}
          width={tileWidth}
          height={tileHeight}
          alt={`Page ${pageNum}`}
          className="block rounded"
          draggable={false}
        />
      ) : (
        <div
          className="rounded bg-[#eee8d5] dark:bg-[#073642]"
          style={{ width: tileWidth, height: tileHeight }}
        />
      )}
      <span className={`absolute bottom-0 left-0 right-0 rounded-b px-1 py-0.5 text-center text-[10px] tabular-nums ${
        isCurrent
          ? 'bg-[#268bd2] text-white'
          : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
      }`}>
        {pageNum}
      </span>
    </button>
  )
}

export function OutlineSidebar({ docInfo, fullPath, currentPage, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll the current page tile into view when the sidebar opens or page changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const tile = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement | null
    tile?.scrollIntoView({ block: 'nearest' })
  }, [currentPage])

  return (
    <div ref={containerRef} className="flex h-full flex-wrap content-start gap-2 overflow-y-auto p-2">
      {docInfo.pages.map((page, i) => {
        const pageNum = i + 1
        return (
          <div key={pageNum} data-page={pageNum}>
            <PageTile
              pageNum={pageNum}
              fullPath={fullPath}
              aspectRatio={page.aspect_ratio}
              isCurrent={pageNum === currentPage}
              onNavigate={onNavigate}
            />
          </div>
        )
      })}
    </div>
  )
}
