import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { weather, chat } from '@/lib/api'
import type { Weather } from '@/lib/api'

describe('weather helper', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  function makeResponse(body: unknown, status = 200) {
    const bodyStr = JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(bodyStr),
    } as Response
  }

  it('weather.get hits /api/chat/weather and returns typed Weather', async () => {
    const w: Weather = { temperatureC: 4, feelsLikeC: -1, condition: 'snow', available: true }
    mockFetch.mockResolvedValue(makeResponse(w))

    const result = await weather.get()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/weather')
    expect(init.method).toBe('GET')
    expect(result).toEqual(w)
  })

  it('chat.getWeather hits /api/chat/weather and returns unavailable payload', async () => {
    const w: Weather = { temperatureC: null, feelsLikeC: null, condition: null, available: false }
    mockFetch.mockResolvedValue(makeResponse(w))

    const result = await chat.getWeather()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/weather')
    expect(init.method).toBe('GET')
    expect(result.available).toBe(false)
  })

  it('injects Authorization header when token is in localStorage', async () => {
    localStorage.setItem('clossette_token', 'fake-token')
    mockFetch.mockResolvedValue(
      makeResponse({ temperatureC: 4, feelsLikeC: -1, condition: 'snow', available: true })
    )

    await weather.get()

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer fake-token')
  })
})
