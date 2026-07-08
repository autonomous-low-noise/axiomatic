import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useRef } from 'react'
import { Input } from '../Input'

describe('Input', () => {
  it('renders a text input and forwards value/onChange', () => {
    const onChange = vi.fn()
    render(<Input value="abc" onChange={onChange} aria-label="name" />)
    const input = screen.getByLabelText('name')
    expect(input).toHaveValue('abc')
    fireEvent.change(input, { target: { value: 'abcd' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('uses the canonical focus accent (token blue)', () => {
    render(<Input aria-label="name" />)
    expect(screen.getByLabelText('name').className).toContain(
      'focus:border-blue',
    )
  })

  it('styles placeholders with muted tokens', () => {
    render(<Input aria-label="name" placeholder="hint" />)
    const cls = screen.getByLabelText('name').className
    expect(cls).toContain('placeholder:text-base1')
    expect(cls).toContain('dark:placeholder:text-base01')
  })

  it('panel surface uses the deeper dark background', () => {
    render(<Input aria-label="name" surface="panel" />)
    expect(screen.getByLabelText('name').className).toContain('dark:bg-base03')
  })

  it('page surface (default) uses the raised dark background', () => {
    render(<Input aria-label="name" />)
    expect(screen.getByLabelText('name').className).toContain('dark:bg-base02')
  })

  it('supports ref as a prop (React 19)', () => {
    function Harness() {
      const ref = useRef<HTMLInputElement>(null)
      return (
        <>
          <Input ref={ref} aria-label="name" />
          <button onClick={() => ref.current?.focus()}>focus</button>
        </>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByText('focus'))
    expect(screen.getByLabelText('name')).toHaveFocus()
  })

  it('merges custom className', () => {
    render(<Input aria-label="name" className="w-full" />)
    expect(screen.getByLabelText('name').className).toContain('w-full')
  })
})
