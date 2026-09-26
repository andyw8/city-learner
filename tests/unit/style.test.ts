import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { BASEMAP_STYLE_URL, basemapStyle, hideLabels } from '../../src/map/style'

const style = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background' },
    { id: 'place-labels', type: 'symbol', source: 'base', layout: { visibility: 'visible' } },
  ],
} as unknown as StyleSpecification

describe('hideLabels', () => {
  it('hides symbol layers and leaves other layers alone', () => {
    const hidden = hideLabels(style)
    expect(hidden.layers.find((layer) => layer.id === 'place-labels')?.layout?.visibility).toBe(
      'none',
    )
    expect(hidden.layers.find((layer) => layer.id === 'background')?.layout?.visibility).toBe(
      undefined,
    )
  })
})

describe('basemapStyle', () => {
  it('fetches the hosted style and hides its labels', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(style), { status: 200 }))
    const result = await basemapStyle(fetchImpl as unknown as typeof fetch)

    expect(fetchImpl).toHaveBeenCalledWith(BASEMAP_STYLE_URL)
    expect(result.layers.find((layer) => layer.id === 'place-labels')?.layout?.visibility).toBe(
      'none',
    )
  })

  it('throws on an error response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))
    await expect(basemapStyle(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      'Failed to load basemap style: 500',
    )
  })
})
