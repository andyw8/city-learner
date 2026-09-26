import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { checkLocate } from '../deck/distance'
import type { Deck, Feature, Position } from '../deck/types'
import { clearGuess, clearHighlight, setGuess, setHighlight } from '../map/highlight'
import { setLabelsVisible } from '../map/labels'
import { fitDeck } from '../map/view'
import { el } from './dom'
import type { SessionMode } from './session'

export interface LocateHandlers {
  onAnswered?: (feature: Feature, correct: boolean) => void
  onFinished?: () => void
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

export function startLocate(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  handlers: LocateHandlers = {},
): SessionMode {
  let index = 0
  let removeClick: (() => void) | undefined

  const render = (): void => {
    removeClick?.()
    removeClick = undefined

    const feature = deck.features[index]
    if (!feature) {
      if (window.cityLearner) window.cityLearner.current = undefined
      map.getCanvas().style.cursor = ''
      panel.replaceChildren(el('h2', { textContent: 'Session complete' }))
      handlers.onFinished?.()
      return
    }

    if (window.cityLearner) {
      window.cityLearner.current = { featureId: feature.id, mode: 'locate' }
    }

    clearHighlight(map)
    clearGuess(map)
    setLabelsVisible(map, false)
    map.getCanvas().style.cursor = 'crosshair'

    const feedback = el('p', { className: 'feedback' })
    feedback.setAttribute('aria-live', 'polite')

    const nextButton = el('button', {
      type: 'button',
      className: 'next',
      textContent: 'Next',
      hidden: true,
    })
    nextButton.addEventListener('click', () => {
      index += 1
      render()
    })

    panel.replaceChildren(
      el('h2', { textContent: `Where is ${feature.name}?` }),
      el('p', { className: 'prompt-description', textContent: feature.description }),
      el('p', { className: 'hint', textContent: 'Click the map to place your answer.' }),
      feedback,
      nextButton,
    )

    let answered = false
    const onClick = (event: MapMouseEvent): void => {
      if (answered) return
      answered = true
      map.getCanvas().style.cursor = ''

      const point: Position = [event.lngLat.lng, event.lngLat.lat]
      const result = checkLocate(point, feature)

      setGuess(map, point, result.correct)
      setHighlight(map, feature)
      setLabelsVisible(map, true)

      feedback.textContent = result.correct
        ? `Correct — ${formatDistance(result.distanceM)} from ${feature.name}.`
        : `Not quite — you were ${formatDistance(result.distanceM)} away. That is ${feature.name}.`
      nextButton.hidden = false
      handlers.onAnswered?.(feature, result.correct)
    }

    map.on('click', onClick)
    removeClick = () => map.off('click', onClick)
  }

  fitDeck(map, deck)
  render()

  return {
    stop: () => {
      removeClick?.()
      removeClick = undefined
      map.getCanvas().style.cursor = ''
    },
    isFinished: () => index >= deck.features.length,
  }
}
