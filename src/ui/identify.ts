import type { Map as MapLibreMap } from 'maplibre-gl'
import { buildChoices, type Choice } from '../deck/choices'
import type { Deck, Feature } from '../deck/types'
import { focusFeature, setHighlight } from '../map/highlight'
import { setLabelsVisible } from '../map/labels'
import { el } from './dom'
import type { Presentation } from './session'

export function presentIdentify(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  feature: Feature,
): Presentation {
  let resolvePromise: (correct: boolean) => void = () => {}
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve
  })

  if (window.cityLearner) {
    window.cityLearner.current = { featureId: feature.id, mode: 'identify' }
  }

  setHighlight(map, feature)
  focusFeature(map, feature)
  setLabelsVisible(map, false)

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

  let answered = false
  let result = false

  const answer = (choice: Choice): void => {
    if (answered) return
    answered = true
    result = choice.featureId === feature.id

    for (const button of options.querySelectorAll('button')) {
      button.disabled = true
      if (button.dataset.featureId === feature.id) button.classList.add('correct')
      else if (button.dataset.featureId === choice.featureId) button.classList.add('wrong')
    }

    feedback.textContent = result
      ? `Correct — ${feature.name}.`
      : `Not quite. That is ${feature.name}. ${feature.description}`
    nextButton.hidden = false
    setLabelsVisible(map, true)
  }

  for (const choice of buildChoices(deck, feature)) {
    const button = el('button', { type: 'button', textContent: choice.name })
    button.dataset.featureId = choice.featureId
    button.addEventListener('click', () => answer(choice))
    options.append(button)
  }

  nextButton.addEventListener('click', () => resolvePromise(result))

  panel.replaceChildren(
    el('h2', { textContent: 'What is the highlighted feature?' }),
    options,
    feedback,
    nextButton,
  )

  return {
    promise,
    cancel: () => {
      resolvePromise(false)
      setLabelsVisible(map, false)
    },
  }
}
