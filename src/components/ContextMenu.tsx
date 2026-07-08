import { Menu } from './ui/Menu'

export interface MenuItem {
  label: string
  action: () => void
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** Point-positioned action menu — thin wrapper over the ui/Menu primitive. */
export function ContextMenu({ x, y, items, onClose }: Props) {
  return <Menu point={{ x, y }} items={items} onClose={onClose} />
}
