import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chat } from '@/lib/api'
import type { ChatSession, ChatMessage } from '@/lib/api'

describe('chat helper', () => {
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

  it('listSessions calls GET /api/chat/sessions', async () => {
    const sessions: ChatSession[] = [{ id: 1, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }]
    mockFetch.mockResolvedValue(makeResponse(sessions))

    const result = await chat.listSessions()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/sessions')
    expect(init.method).toBe('GET')
    expect(result).toEqual(sessions)
  })

  it('createSession calls POST /api/chat/sessions', async () => {
    const session: ChatSession = { id: 2, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' }
    mockFetch.mockResolvedValue(makeResponse(session))

    const result = await chat.createSession()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/sessions')
    expect(init.method).toBe('POST')
    expect(result.id).toBe(2)
  })

  it('getMessages calls GET /api/chat/sessions/:id/messages', async () => {
    const messages: ChatMessage[] = [
      { id: 10, role: 'ASSISTANT', content: 'Hi', createdAt: '2026-01-01T00:00:00Z' },
    ]
    mockFetch.mockResolvedValue(makeResponse(messages))

    await chat.getMessages(7)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/sessions/7/messages')
    expect(init.method).toBe('GET')
  })

  it('sendMessage POSTs {content} to the session and injects JWT', async () => {
    localStorage.setItem('clossette_token', 'jwt-token')
    const reply: ChatMessage = {
      id: 11,
      role: 'ASSISTANT',
      content: 'Here is a look',
      suggestions: ['Yes!'],
      createdAt: '2026-01-01T00:00:00Z',
    }
    mockFetch.mockResolvedValue(makeResponse(reply))

    const result = await chat.sendMessage(7, 'dinner Friday')

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat/sessions/7/messages')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: 'dinner Friday' }))
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-token')
    expect(result.suggestions).toEqual(['Yes!'])
  })
})
