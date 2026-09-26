import { describe, expect, it } from 'vitest'
import { HttpRangeSource } from '../../src/map/pmtiles'

const full = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])

function sourceWith(response: () => Response): HttpRangeSource {
  return new HttpRangeSource('/tiles/toronto.pmtiles', async () => response())
}

describe('HttpRangeSource', () => {
  it('returns the requested range from a 206 response', async () => {
    const source = sourceWith(() => new Response(full.slice(2, 6), { status: 206 }))
    const { data } = await source.getBytes(2, 4)
    expect([...new Uint8Array(data)]).toEqual([2, 3, 4, 5])
  })

  it('slices a full 200 response that ignored the range', async () => {
    const source = sourceWith(() => new Response(full, { status: 200 }))
    const { data } = await source.getBytes(2, 4)
    expect([...new Uint8Array(data)]).toEqual([2, 3, 4, 5])
  })

  it('sends a Range header', async () => {
    let sentRange: string | null = null
    const source = new HttpRangeSource('/tiles/toronto.pmtiles', async (_url, init) => {
      const headers = new Headers(init?.headers)
      sentRange = headers.get('range')
      return new Response(full.slice(0, 4), { status: 206 })
    })
    await source.getBytes(0, 4)
    expect(sentRange).toBe('bytes=0-3')
  })

  it('throws on error responses', async () => {
    const source = sourceWith(() => new Response('nope', { status: 500 }))
    await expect(source.getBytes(0, 4)).rejects.toThrow('Bad response code: 500')
  })

  it('fetches the whole archive once when the host ignores ranges', async () => {
    let calls = 0
    const source = new HttpRangeSource('/tiles/toronto.pmtiles', async () => {
      calls++
      return new Response(full, { status: 200 })
    })
    const first = await source.getBytes(2, 4)
    const second = await source.getBytes(4, 2)
    expect([...new Uint8Array(first.data)]).toEqual([2, 3, 4, 5])
    expect([...new Uint8Array(second.data)]).toEqual([4, 5])
    expect(calls).toBe(1)
  })
})
