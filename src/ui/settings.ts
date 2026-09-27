import { CATEGORIES, type Category } from '../deck/types'
import { loadSettings, type Settings, type Tolerances } from '../settings'
import { el } from './dom'

function toleranceField(category: Category, value: number): { label: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    id: `tolerance-${category}`,
    type: 'number',
    min: '1',
    max: '5000',
    value: String(value),
    inputMode: 'numeric',
  })
  input.dataset.category = category
  return {
    label: el('label', { htmlFor: `tolerance-${category}` }, [`${category} tolerance (m)`]),
    input,
  }
}

export async function renderSettings(
  panel: HTMLElement,
  onSave: (settings: Settings) => void | Promise<void>,
): Promise<void> {
  const settings = await loadSettings()
  panel.innerHTML = ''

  const newLimit = el('input', {
    id: 'new-limit',
    type: 'number',
    min: '0',
    max: '500',
    value: String(settings.newLimit),
    inputMode: 'numeric',
  })

  const fields = CATEGORIES.map((category) =>
    toleranceField(category, settings.tolerances[category]),
  )

  const form = el('form', { className: 'settings' }, [
    el('h2', {}, ['Settings']),
    el('label', { htmlFor: 'new-limit' }, ['New cards per day']),
    newLimit,
    el('p', { className: 'hint', textContent: 'Locate tolerance by category:' }),
    ...fields.flatMap(({ label, input }) => [label, input]),
    el('button', { type: 'submit' }, ['Save']),
  ])

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const tolerances = Object.fromEntries(
      fields.map(({ input }) => [input.dataset.category, Number(input.value)]),
    ) as Tolerances
    void onSave({
      newLimit: Number(newLimit.value),
      tolerances,
      city: settings.city,
    })
  })

  panel.append(form)
}
