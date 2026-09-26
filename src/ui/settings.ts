import { loadSettings, type Settings } from '../settings'
import { el } from './dom'

export async function renderSettings(
  panel: HTMLElement,
  onSave: (settings: Settings) => void | Promise<void>,
): Promise<void> {
  const settings = await loadSettings()
  panel.innerHTML = ''

  const input = el('input', {
    id: 'new-limit',
    type: 'number',
    min: '0',
    max: '500',
    value: String(settings.newLimit),
  })

  const form = el('form', { className: 'settings' }, [
    el('h2', {}, ['Settings']),
    el('label', { htmlFor: 'new-limit' }, ['New cards per day']),
    input,
    el('button', { type: 'submit' }, ['Save']),
  ])

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void onSave({ newLimit: Number(input.value) })
  })

  panel.append(form)
}
