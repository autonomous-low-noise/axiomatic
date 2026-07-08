import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('defaults to type="button" so it never submits forms accidentally', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('allows overriding type', () => {
    render(<Button type="submit">Go</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it.each(['icon', 'primary', 'secondary', 'danger', 'ghost'] as const)(
    'variant %s has a visible focus indicator',
    (variant) => {
      render(<Button variant={variant}>X</Button>)
      expect(screen.getByRole('button').className).toContain(
        'focus-visible:outline-blue',
      )
    },
  )

  it('primary variant uses the solid accent recipe', () => {
    render(<Button variant="primary">Save</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('bg-blue')
    expect(cls).toContain('text-white')
  })

  it('danger variant uses the solid red recipe', () => {
    render(<Button variant="danger">Delete</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('bg-red')
    expect(cls).toContain('text-white')
  })

  it('icon variant shows active state when active', () => {
    render(<Button variant="icon" active aria-label="toggle" />)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('text-blue')
  })

  it('icon variant without active uses muted text with hover bg', () => {
    render(<Button variant="icon" aria-label="toggle" />)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('text-base00')
    expect(cls).toContain('hover:bg-base2')
  })

  it('disabled button is disabled and visually dimmed', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('disabled:opacity-50')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('merges custom className after variant classes', () => {
    render(<Button className="w-full shrink-0">Go</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('w-full')
    expect(cls).toContain('shrink-0')
  })
})
