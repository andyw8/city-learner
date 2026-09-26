import { describe, expect, it } from 'vitest'
import { BASEMAP_SOURCE, basemapStyle } from '../../src/map/style'

describe('basemapStyle', () => {
  it('has no symbol layers, so the map is unlabelled', () => {
    const symbols = basemapStyle().layers.filter((layer) => layer.type === 'symbol')
    expect(symbols).toEqual([])
  })

  it('uses the local PMTiles basemap source', () => {
    const source = basemapStyle().sources[BASEMAP_SOURCE]
    expect(source).toMatchObject({
      type: 'vector',
      url: 'pmtiles:///tiles/toronto.pmtiles',
    })
  })
})
