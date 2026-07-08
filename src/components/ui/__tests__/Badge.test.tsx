import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>done</Badge>)
    expect(screen.getByText('done')).toBeInTheDocument()
  })

  it('pill variant (default) is fully rounded', () => {
    render(<Badge>tag</Badge>)
    expect(screen.getByText('tag').className).toContain('rounded-full')
  })

  it('square variant uses compact square shape', () => {
    render(<Badge variant="square">v2</Badge>)
    const cls = screen.getByText('v2').className
    expect(cls).toContain('rounded')
    expect(cls).not.toContain('rounded-full')
  })

  it('passes through className and style for data-driven colors', () => {
    render(
      <Badge className="text-white" style={{ backgroundColor: '#268bd2' }}>
        math
      </Badge>,
    )
    const el = screen.getByText('math')
    expect(el.className).toContain('text-white')
    expect(el.style.backgroundColor).toBe('rgb(38, 139, 210)')
  })
})
