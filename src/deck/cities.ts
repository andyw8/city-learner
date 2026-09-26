export interface City {
  id: string
  label: string
  deck: string
  center: [number, number]
  zoom: number
}

export const CITIES: City[] = [
  {
    id: 'toronto',
    label: 'Toronto, Canada',
    deck: 'toronto.json',
    center: [-79.3832, 43.6532],
    zoom: 11,
  },
  {
    id: 'glasgow',
    label: 'Glasgow, Scotland',
    deck: 'glasgow.json',
    center: [-4.2518, 55.8642],
    zoom: 12,
  },
]

export const DEFAULT_CITY = CITIES[0]!

export function findCity(id: string): City {
  return CITIES.find((city) => city.id === id) ?? DEFAULT_CITY
}
