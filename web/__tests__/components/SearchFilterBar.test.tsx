import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchFilterBar } from '@/components/SearchFilterBar'

// Stub the category fetch so the component mounts without a real network call.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue([]) },
}))

describe('SearchFilterBar — Local designers toggle', () => {
  const noop = () => {}

  it('renders the toggle when onLocal is provided', () => {
    render(
      <SearchFilterBar onSearch={noop} onCategory={noop} onSort={noop} onLocal={noop} />,
    )
    expect(screen.getByLabelText('Show only local designers')).toBeInTheDocument()
  })

  it('does not render the toggle when onLocal is omitted', () => {
    render(<SearchFilterBar onSearch={noop} onCategory={noop} onSort={noop} />)
    expect(screen.queryByLabelText('Show only local designers')).toBeNull()
  })

  it('emits onLocal(true) when toggled on', async () => {
    const onLocal = vi.fn()
    const user = userEvent.setup()
    render(
      <SearchFilterBar
        onSearch={noop}
        onCategory={noop}
        onSort={noop}
        onLocal={onLocal}
        localActive={false}
      />,
    )

    await user.click(screen.getByLabelText('Show only local designers'))

    expect(onLocal).toHaveBeenCalledWith(true)
  })
})
