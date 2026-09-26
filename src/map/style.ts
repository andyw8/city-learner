import type { StyleSpecification } from 'maplibre-gl'

export const BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

/** Hide every label layer so the map can be answered from shape alone. */
export function hideLabels(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      layer.type === 'symbol'
        ? { ...layer, layout: { ...layer.layout, visibility: 'none' as const } }
        : layer,
    ),
  }
}

export async function basemapStyle(
  fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
): Promise<StyleSpecification> {
  const response = await fetchImpl(BASEMAP_STYLE_URL)
  if (!response.ok) {
    throw new Error(`Failed to load basemap style: ${response.status}`)
  }
  return hideLabels((await response.json()) as StyleSpecification)
}
