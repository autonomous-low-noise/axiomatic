import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface SnipBannerProps {
  onSave: (label: string) => void
  onCancel: () => void
}

export function SnipBanner({ onSave, onCancel }: SnipBannerProps) {
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    if (label.trim()) onSave(label.trim())
  }, [label, onSave])

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-base2 bg-base2/60 px-4 py-2 dark:border-base02 dark:bg-base02/60">
      <span className="text-sm text-base00 dark:text-base1">Label:</span>
      <Input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
        }}
        placeholder="e.g. Chain rule formula"
        surface="panel"
        className="min-w-0 flex-1"
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={!label.trim()}
        className="shrink-0"
      >
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="shrink-0"
      >
        Cancel
      </Button>
    </div>
  )
}
