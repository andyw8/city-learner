import type { Map as MapLibreMap } from 'maplibre-gl'
import { buildChoices, type Choice } from '../deck/choices'
import { matchesAnswer } from '../deck/matching'
import { featureNoun } from '../deck/noun'
import type { Deck, Feature } from '../deck/types'
import { focusFeature, setHighlight } from '../map/highlight'
import { setLabelsVisible } from '../map/labels'
import {
  IDENTIFY_MODE_LABELS,
  IDENTIFY_MODES,
  type IdentifyAnswerMode,
} from '../settings'
import { el } from './dom'
import type { Presentation } from './session'

export interface IdentifyOptions {
  mode: IdentifyAnswerMode
  onModeChange: (mode: IdentifyAnswerMode) => void
}

export function presentIdentify(
  map: MapLibreMap,
  deck: Deck,
  panel: HTMLElement,
  feature: Feature,
  options: IdentifyOptions,
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

  let answered = false
  let result = false
  let mode = options.mode

  const feedback = el('p', { className: 'feedback' })
  feedback.setAttribute('aria-live', 'polite')

  const nextButton = el('button', {
    type: 'button',
    className: 'next',
    textContent: 'Next',
    hidden: true,
  })
  nextButton.addEventListener('click', () => resolvePromise(result))

  const modeToggle = el('div', { className: 'answer-mode' })
  modeToggle.setAttribute('role', 'group')
  modeToggle.setAttribute('aria-label', 'Answer mode')
  const modeButtons = IDENTIFY_MODES.map((value) => {
    const button = el('button', { type: 'button', textContent: IDENTIFY_MODE_LABELS[value] })
    button.dataset.mode = value
    button.addEventListener('click', () => selectMode(value))
    modeToggle.append(button)
    return button
  })

  const body = el('div', { className: 'identify-body' })

  function finish(correct: boolean, message: string): void {
    answered = true
    result = correct
    feedback.textContent = message
    nextButton.hidden = false
    setLabelsVisible(map, true)
  }

  function correctMessage(): string {
    return `Correct — ${feature.name}.`
  }

  function wrongMessage(): string {
    return `Not quite — the answer is ${feature.name}. ${feature.description}`
  }

  function renderFreeText(): void {
    const input = el('input', {
      id: 'identify-answer',
      type: 'text',
      placeholder: 'Type the name',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: false,
    })
    input.setAttribute('aria-label', 'Your answer')

    const check = el('button', { type: 'submit', className: 'next', textContent: 'Check' })
    const form = el('form', { className: 'free-text' }, [input, check])

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (answered) return
      input.disabled = true
      check.disabled = true
      const correct = matchesAnswer(input.value, feature)
      finish(correct, correct ? correctMessage() : wrongMessage())
    })

    body.append(form)
  }

  function renderMultipleChoice(): void {
    const choices = el('div', { className: 'options' })
    choices.setAttribute('role', 'group')
    choices.setAttribute('aria-label', 'Answers')

    const answer = (choice: Choice): void => {
      if (answered) return
      for (const button of choices.querySelectorAll('button')) {
        button.disabled = true
        if (button.dataset.featureId === feature.id) button.classList.add('correct')
        else if (button.dataset.featureId === choice.featureId) button.classList.add('wrong')
      }
      const correct = choice.featureId === feature.id
      finish(correct, correct ? correctMessage() : `Not quite. That is ${feature.name}. ${feature.description}`)
    }

    for (const choice of buildChoices(deck, feature)) {
      const button = el('button', { type: 'button', textContent: choice.name })
      button.dataset.featureId = choice.featureId
      button.addEventListener('click', () => answer(choice))
      choices.append(button)
    }

    body.append(choices)
  }

  function setModeButtons(): void {
    for (const button of modeButtons) {
      const active = button.dataset.mode === mode
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    }
  }

  function render(): void {
    body.replaceChildren()
    if (mode === 'free-text') renderFreeText()
    else renderMultipleChoice()
    setModeButtons()
  }

  function selectMode(next: IdentifyAnswerMode): void {
    mode = next
    options.onModeChange(next)
    if (!answered) render()
    else setModeButtons()
  }

  render()

  panel.replaceChildren(
    el('h2', { textContent: `What is the highlighted ${featureNoun(feature)}?` }),
    modeToggle,
    body,
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
