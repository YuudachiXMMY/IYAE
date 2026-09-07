import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchFilterBar } from '@/components/SearchFilterBar'

describe('SearchFilterBar — shop filter row', () => {
  const noop = () => {}

  it('renders all five filter pills', () => {
    render(
      <SearchFilterBar
        activeFilter="forYou"
        onFilter={noop}
        sort="createdAt,desc"
        onSort={noop}
        count={12}
      />,
    )
    for (const label of [
      'For You',
      'New In',
      'Local Designers',
      'Clothing',
      'Accessories',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the active pill with aria-pressed', () => {
    render(
      <SearchFilterBar
        activeFilter="local"
        onFilter={noop}
        sort="createdAt,desc"
        onSort={noop}
        count={0}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Local Designers' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'For You' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('emits onFilter with the pill key when clicked', async () => {
    const onFilter = vi.fn()
    const user = userEvent.setup()
    render(
      <SearchFilterBar
        activeFilter="forYou"
        onFilter={onFilter}
        sort="createdAt,desc"
        onSort={noop}
        count={0}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Local Designers' }))

    expect(onFilter).toHaveBeenCalledWith('local')
  })

  it('renders the piece count', () => {
    render(
      <SearchFilterBar
        activeFilter="forYou"
        onFilter={noop}
        sort="createdAt,desc"
        onSort={noop}
        count={42}
      />,
    )
    expect(screen.getByText('42 pieces')).toBeInTheDocument()
  })
})
