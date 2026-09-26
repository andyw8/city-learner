import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { checkLocate } from '../deck/distance'
import type { Category, Deck, Feature, Position } from '../deck/types'
import { clearGuess, clearHighlight, setGuess, setHighlight } from '../map/highlight'
import { setLabelsVisible } from '../map/labels'
import { fitDeck } from '../map/view'
import { el } from './dom'
import type { Presentation } from './session'

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

export function presentLocate(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  feature: Feature,
  tolerances?: Partial<Record<Category, number>>,
): Presentation {
  let resolvePromise: (correct: boolean) => void = () => {}
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })

  if (window.cityLearner) {
    window.cityLearner.current = { featureId: feature.id, mode: 'locate' }
  }

  clearHighlight(map)
  clearGuess(map)
  setLabelsVisible(map, false)
  fitDeck(map, deck)
  map.getCanvas().style.cursor = 'crosshair'

  const feedback = el('p', { className: 'feedback' })
  feedback.setAttribute('aria-live', 'polite')

  const nextButton = el('button', {
    type: 'button',
    className: 'next',
    textContent: 'Next',
    hidden: true,
  })

  let answered = false
  let result = false

  const onClick = (event: MapMouseEvent): void => {
    if (answered) return
    answered = true
    map.getCanvas().style.cursor = ''

    const point: Position = [event.lngLat.lng, event.lngLat.lat]
    const located = checkLocate(point, feature, tolerances)
    result = located.correct

    setGuess(map, point, located.correct)
    setHighlight(map, feature)
    setLabelsVisible(map, true)

    feedback.textContent = located.correct
      ? `Correct — ${formatDistance(located.distanceM)} from ${feature.name}.`
      : `Not quite — you were ${formatDistance(located.distanceM)} away. That is ${feature.name}.`
    nextButton.hidden = false
  }

  map.on('click', onClick)
  nextButton.addEventListener('click', () => {
    map.off('click', onClick)
    resolvePromise(result)
  })

  panel.replaceChildren(
    el('h2', { textContent: `Where is ${feature.name}?` }),
    el('p', { className: 'prompt-description', textContent: feature.description }),
    el('p', { className: 'hint', textContent: 'Tap the map to place your answer.' }),
    feedback,
    nextButton,
  )

  return {
    promise,
    cancel: () => {
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
      resolvePromise(false)
      setLabelsVisible(map, false)
    },
  }
}
