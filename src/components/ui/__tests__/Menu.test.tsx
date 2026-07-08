import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Menu, type MenuItemSpec } from '../Menu'

const items: MenuItemSpec[] = [
  { label: 'Open', action: vi.fn() },
  { label: 'Rename', action: vi.fn() },
  { label: 'Delete', action: vi.fn(), danger: true },
]

function renderMenu(overrides: Partial<Parameters<typeof Menu>[0]> = {}) {
  const onClose = vi.fn()
  const result = render(
    <Menu point={{ x: 100, y: 200 }} items={items} onClose={onClose} {...overrides} />,
  )
  return { onClose, ...result }
}

describe('Menu (items mode)', () => {
  it('renders all items with menu roles', () => {
    renderMenu()
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('clicking an item fires its action and closes', () => {
    const action = vi.fn()
    const { onClose } = renderMenu({ items: [{ label: 'Only', action }] })
    fireEvent.click(screen.getByText('Only'))
    expect(action).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes the menu', () => {
    const { onClose } = renderMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('mousedown outside closes the menu', () => {
    const { onClose } = renderMenu()
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('j/k cycle the focused item and Enter activates it', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { onClose } = renderMenu({
      items: [
        { label: 'First', action: first },
        { label: 'Second', action: second },
      ],
    })
    fireEvent.keyDown(document, { key: 'j' })
    fireEvent.keyDown(document, { key: 'j' })
    fireEvent.keyDown(document, { key: 'k' })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('danger items are rendered in red', () => {
    renderMenu()
    expect(screen.getByText('Delete').className).toContain('text-red')
  })

  it('point-mode menus close on scroll', () => {
    const { onClose } = renderMenu()
    window.dispatchEvent(new Event('scroll'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Menu (children/popover mode)', () => {
  it('renders arbitrary children anchored to an element', () => {
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    const onClose = vi.fn()
    render(
      <Menu anchorRef={{ current: anchor }} onClose={onClose}>
        <p>popover body</p>
      </Menu>,
    )
    expect(screen.getByText('popover body')).toBeInTheDocument()
    anchor.remove()
  })

  it('mousedown on the anchor does not close (anchor toggles instead)', () => {
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    const onClose = vi.fn()
    render(
      <Menu anchorRef={{ current: anchor }} onClose={onClose}>
        <p>popover body</p>
      </Menu>,
    )
    fireEvent.mouseDown(anchor)
    expect(onClose).not.toHaveBeenCalled()
    anchor.remove()
  })

  it('does not close on scroll by default in anchor mode', () => {
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    const onClose = vi.fn()
    render(
      <Menu anchorRef={{ current: anchor }} onClose={onClose}>
        <p>popover body</p>
      </Menu>,
    )
    window.dispatchEvent(new Event('scroll'))
    expect(onClose).not.toHaveBeenCalled()
    anchor.remove()
  })
})
