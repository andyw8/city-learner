import { describe, expect, it } from 'vitest'
import { BASEMAP_SOURCE, basemapStyle } from '../../src/map/style'

describe('basemapStyle', () => {
  it('includes label layers, all hidden by default', () => {
    const symbols = basemapStyle().layers.filter((layer) => layer.type === 'symbol')

    expect(symbols.length).toBeGreaterThan(0)
    for (const layer of symbols) {
      expect(layer.layout?.visibility).toBe('none')
    }
  })

  it('provides glyphs and a sprite so labels can be shown', () => {
    const style = basemapStyle()
    expect(style.glyphs).toContain('{fontstack}')
    expect(style.sprite).toBeTruthy()
  })

  it('uses the local PMTiles basemap source', () => {
    const source = basemapStyle().sources[BASEMAP_SOURCE]
    expect(source).toMatchObject({
      type: 'vector',
      url: 'pmtiles:///tiles/toronto.pmtiles',
    })
  })
})
