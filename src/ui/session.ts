import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Deck, Feature, Mode } from '../deck/types'
import type { Card } from '../srs/types'
import { el } from './dom'
import { presentIdentify } from './identify'
import { presentLocate } from './locate'

export interface ReviewItem {
  feature: Feature
  mode: Mode
  card?: Card
}

export interface Presentation {
  promise: Promise<boolean>
  cancel: () => void
}

export interface SessionMode {
  stop(): void
  isFinished(): boolean
}

export interface SessionOptions {
  onAnswer?: (item: ReviewItem, correct: boolean) => void | Promise<void>
  finishMessage?: string
}

export function runSession(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  items: ReviewItem[],
  options: SessionOptions = {},
): SessionMode {
  let index = 0
  let stopped = false
  let current: Presentation | undefined

  const run = async (): Promise<void> => {
    for (; index < items.length; index++) {
      if (stopped) return

      const item = items[index]
      if (!item) return

      current =
        item.mode === 'identify'
          ? presentIdentify(map, deck, panel, item.feature)
          : presentLocate(map, deck, panel, item.feature)

      const correct = await current.promise
      current = undefined
      if (stopped) return

      await options.onAnswer?.(item, correct)
    }

    if (stopped) return

    if (window.cityLearner) window.cityLearner.current = undefined
    map.getCanvas().style.cursor = ''
    panel.replaceChildren(
      el('h2', { textContent: options.finishMessage ?? 'Session complete' }),
    )
  }

  void run()

  return {
    stop: () => {
      stopped = true
      current?.cancel()
    },
    isFinished: () => index >= items.length,
  }
}
