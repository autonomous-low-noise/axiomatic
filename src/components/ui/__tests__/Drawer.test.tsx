import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Drawer } from '../Drawer'
import { Panel, PanelHeader } from '../Panel'

describe('Drawer', () => {
  it('renders title, children and a close button', () => {
    const onClose = vi.fn()
    render(
      <Drawer title="Tags" onClose={onClose}>
        <p>drawer body</p>
      </Drawer>,
    )
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('drawer body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes the drawer', () => {
    const onClose = vi.fn()
    render(
      <Drawer title="Tags" onClose={onClose}>
        <p>drawer body</p>
      </Drawer>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking outside does NOT close (drawers are persistent)', () => {
    const onClose = vi.fn()
    render(
      <Drawer title="Tags" onClose={onClose}>
        <p>drawer body</p>
      </Drawer>,
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Panel', () => {
  it('renders a bordered card with children', () => {
    render(<Panel>card body</Panel>)
    const el = screen.getByText('card body')
    expect(el.className).toContain('border')
    expect(el.className).toContain('rounded-lg')
  })

  it('PanelHeader renders a bordered header row', () => {
    render(<PanelHeader>header</PanelHeader>)
    expect(screen.getByText('header').className).toContain('border-b')
  })
})
