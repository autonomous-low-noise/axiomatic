import { memo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { BookProgress, BookStatus } from '../types/progress'
import type { Tag } from '../hooks/useTags'
import { PdfThumbnail } from './PdfThumbnail'
import { Badge } from './ui/Badge'
import { Z } from '../lib/zIndex'

interface Props {
  slug: string
  title: string
  fullPath: string
  progress?: BookProgress
  starred?: boolean
  selected?: boolean
  tags?: Tag[]
  bookStatus?: BookStatus
  onToggleStar?: (slug: string) => void
  onContextMenu?: (slug: string, x: number, y: number) => void
}

export const BookTile = memo(function BookTile({
  slug,
  title,
  fullPath,
  progress,
  starred,
  selected,
  onToggleStar,
  onContextMenu,
  tags,
  bookStatus,
}: Props) {
  const progressText = progress
    ? `${progress.currentPage}/${progress.totalPages}`
    : null

  const tileRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (selected && tileRef.current) {
      tileRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [selected])

  return (
    <Link
      ref={tileRef}
      to={`/read/${slug}`}
      className={`group flex flex-col gap-2 rounded-lg p-2 hover:bg-base2 dark:hover:bg-base02 ${selected ? 'ring-2 ring-blue bg-blue/10 dark:bg-blue/20' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(slug, e.clientX, e.clientY)
      }}
    >
      <div className="relative">
        <PdfThumbnail fullPath={fullPath} />
        {bookStatus && bookStatus !== 'open' && (
          <Badge variant="square" className={`absolute bottom-2 left-2 ${Z.raised} text-white ${
            bookStatus === 'done'
              ? 'bg-green/90'
              : bookStatus === 'need-revisit'
                ? 'bg-orange/90'
                : 'bg-blue/90'
          }`}>
            {bookStatus === 'done' ? 'done' : bookStatus === 'need-revisit' ? 'revisit' : 'reading'}
          </Badge>
        )}
        {progressText && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {progressText}
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleStar?.(slug)
          }}
          className="absolute top-1.5 right-1.5 rounded-full bg-black/40 p-1 text-white opacity-0 hover:bg-black/60 group-hover:opacity-100 aria-[pressed=true]:opacity-100"
          aria-pressed={!!starred}
          aria-label={starred ? 'Unstar book' : 'Star book'}
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill={starred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M10 2l2.39 4.84L17.3 7.7l-3.65 3.56.86 5.03L10 13.77l-4.51 2.52.86-5.03L2.7 7.7l4.91-.86L10 2z" />
          </svg>
        </button>
        {tags && tags.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-1 p-1.5 opacity-0 group-hover:opacity-100">
            {tags.slice(0, 3).map((t) => (
              <Badge
                key={t.id}
                variant="square"
                className="text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="square" className="bg-black/50 text-white">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
      <span className="truncate text-sm font-medium text-base02 dark:text-base2 dark:group-hover:text-base3">
        {title}
      </span>
    </Link>
  )
}, (prev, next) =>
  prev.slug === next.slug &&
  prev.title === next.title &&
  prev.fullPath === next.fullPath &&
  prev.starred === next.starred &&
  prev.selected === next.selected &&
  prev.tags === next.tags &&
  prev.bookStatus === next.bookStatus &&
  prev.onToggleStar === next.onToggleStar &&
  prev.onContextMenu === next.onContextMenu &&
  prev.progress?.currentPage === next.progress?.currentPage &&
  prev.progress?.totalPages === next.progress?.totalPages)
