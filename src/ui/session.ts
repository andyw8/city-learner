import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Category, Deck, Feature, Mode } from '../deck/types'
import type { IdentifyAnswerMode } from '../settings'
import type { Card } from '../srs/types'
import { el, statTile } from './dom'
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
  tolerances?: Partial<Record<Category, number>>
  getIdentifyMode?: () => IdentifyAnswerMode
  onIdentifyModeChange?: (mode: IdentifyAnswerMode) => void
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
  let answered = 0
  let correctCount = 0

  const run = async (): Promise<void> => {
    for (; index < items.length; index++) {
      if (stopped) return

      const item = items[index]
      if (!item) return

      current =
        item.mode === 'identify'
          ? presentIdentify(map, deck, panel, item.feature, {
              mode: options.getIdentifyMode?.() ?? 'free-text',
              onModeChange: options.onIdentifyModeChange ?? (() => {}),
            })
          : presentLocate(map, deck, panel, item.feature, options.tolerances)

      const correct = await current.promise
      current = undefined
      if (stopped) return

      answered++
      if (correct) correctCount++

      await options.onAnswer?.(item, correct)
    }

    if (stopped) return

    if (window.cityLearner) window.cityLearner.current = undefined
    map.getCanvas().style.cursor = ''

    const content: (Node | string)[] = [
      el('h2', { textContent: options.finishMessage ?? 'Session complete' }),
    ]
    if (answered > 0) {
      content.push(
        el('div', { className: 'stats' }, [
          statTile('Answered', answered),
          statTile('Correct', correctCount),
          statTile('Incorrect', answered - correctCount),
        ]),
      )
    }
    panel.replaceChildren(...content)
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
