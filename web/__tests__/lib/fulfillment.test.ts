import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fulfillment } from '@/lib/api'
import type { PickupLocation, ShippingOption } from '@/lib/api'

describe('fulfillment api', () => {
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

  it('shippingOptions GETs /api/fulfillment/shipping-options and returns the array', async () => {
    const options: ShippingOption[] = [
      { carrier: 'UPS', displayName: 'UPS', fee: 12.99 },
      { carrier: 'PUROLATOR', displayName: 'Purolator', fee: 10.99 },
    ]
    mockFetch.mockResolvedValue(makeResponse(options))

    const result = await fulfillment.shippingOptions()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/fulfillment/shipping-options')
    expect(init.method).toBe('GET')
    expect(result).toEqual(options)
  })

  it('pickupLocations GETs /api/fulfillment/pickup-locations and passes the signal', async () => {
    const locations: PickupLocation[] = [
      { id: 1, name: 'IYAE Studio', addressLine: '401 Queen St W', city: 'Toronto', instructions: 'Ring the buzzer' },
    ]
    mockFetch.mockResolvedValue(makeResponse(locations))
    const controller = new AbortController()

    const result = await fulfillment.pickupLocations(controller.signal)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/fulfillment/pickup-locations')
    expect(init.method).toBe('GET')
    expect(init.signal).toBe(controller.signal)
    expect(result).toEqual(locations)
  })
})
