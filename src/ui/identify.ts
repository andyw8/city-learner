import type { Map as MapLibreMap } from 'maplibre-gl'
import { buildChoices, type Choice } from '../deck/choices'
import type { Deck, Feature } from '../deck/types'
import { focusFeature, setHighlight } from '../map/highlight'
import { el } from './dom'
import type { SessionMode } from './session'

export interface IdentifyHandlers {
  onAnswered?: (feature: Feature, correct: boolean) => void
  onFinished?: () => void
}

export interface IdentifyMode extends SessionMode {
  next: () => void
  currentFeature: () => Feature | undefined
}

export function startIdentify(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  handlers: IdentifyHandlers = {},
): IdentifyMode {
  let index = 0

  const render = (): void => {
    const feature = deck.features[index]
    if (!feature) {
      if (window.cityLearner) window.cityLearner.current = undefined
      panel.replaceChildren(el('h2', { textContent: 'Session complete' }))
      handlers.onFinished?.()
      return
    }

    if (window.cityLearner) {
      window.cityLearner.current = { featureId: feature.id, mode: 'identify' }
    }

    setHighlight(map, feature)
    focusFeature(map, feature)

    const options = el('div', { className: 'options' })
    options.setAttribute('role', 'group')
    options.setAttribute('aria-label', 'Answers')

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

    let answered = false
    const answer = (choice: Choice): void => {
      if (answered) return
      answered = true

      const correct = choice.featureId === feature.id
      for (const button of options.querySelectorAll('button')) {
        button.disabled = true
        if (button.dataset.featureId === feature.id) button.classList.add('correct')
        else if (button.dataset.featureId === choice.featureId) button.classList.add('wrong')
      }

      feedback.textContent = correct
        ? `Correct — ${feature.name}.`
        : `Not quite. That is ${feature.name}. ${feature.description}`
      nextButton.hidden = false
      handlers.onAnswered?.(feature, correct)
    }

    for (const choice of buildChoices(deck, feature)) {
      const button = el('button', { type: 'button', textContent: choice.name })
      button.dataset.featureId = choice.featureId
      button.addEventListener('click', () => answer(choice))
      options.append(button)
    }

    panel.replaceChildren(
      el('h2', { textContent: 'What is the highlighted feature?' }),
      options,
      feedback,
      nextButton,
    )
  }

  render()

  return {
    stop: () => {},
    next: () => {
      index += 1
      render()
    },
    isFinished: () => index >= deck.features.length,
    currentFeature: () => deck.features[index],
  }
}
