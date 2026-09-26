import { describe, expect, it } from 'vitest'
import { ArchiveSource } from '../../src/map/pmtiles'

const full = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])

function sourceWith(fetchImpl: typeof fetch): ArchiveSource {
  return new ArchiveSource('/tiles/toronto.pmtiles', fetchImpl)
}

describe('ArchiveSource', () => {
  it('serves a slice of the downloaded archive', async () => {
    const source = sourceWith(async () => new Response(full, { status: 200 }))
    const { data } = await source.getBytes(2, 4)
    expect([...new Uint8Array(data)]).toEqual([2, 3, 4, 5])
  })

  it('downloads the archive only once', async () => {
    let calls = 0
    const source = sourceWith(async () => {
      calls++
      return new Response(full, { status: 200 })
    })
    const first = await source.getBytes(2, 4)
    const second = await source.getBytes(4, 2)
    expect([...new Uint8Array(first.data)]).toEqual([2, 3, 4, 5])
    expect([...new Uint8Array(second.data)]).toEqual([4, 5])
    expect(calls).toBe(1)
  })

  it('throws on error responses', async () => {
    const source = sourceWith(async () => new Response('nope', { status: 500 }))
    await expect(source.getBytes(0, 4)).rejects.toThrow('Bad response code: 500')
  })
})
