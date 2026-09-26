import type { Deck } from '../deck/types'
import { summarize } from '../srs/stats'
import { loadCards } from '../srs/store'
import { el } from './dom'

function stat(label: string, value: number | string): HTMLElement {
  return el('div', { className: 'stat' }, [
    el('span', { className: 'stat-value', textContent: String(value) }),
    el('span', { className: 'stat-label', textContent: label }),
  ])
}

export async function renderDashboard(panel: HTMLElement, deck: Deck): Promise<void> {
  const cards = await loadCards()
  const stats = summarize(deck, cards, new Date())

  const totals = el('div', { className: 'stats' }, [
    stat('Cards', stats.total),
    stat('Due now', stats.due),
    stat('New', stats.fresh),
    stat('Learning', stats.learning),
    stat('In review', stats.review),
  ])

  const categories = el(
    'div',
    { className: 'stats by-category' },
    Object.entries(stats.byCategory).map(([category, progress]) =>
      el('div', { className: 'category' }, [
        el('span', { className: 'stat-label', textContent: category }),
        el('span', {
          className: 'stat-value',
          textContent: `${progress.learned}/${progress.total}`,
        }),
      ]),
    ),
  )

  panel.innerHTML = ''
  panel.append(
    el('h2', { textContent: 'Progress' }),
    totals,
    el('p', { className: 'hint', textContent: 'Learned per category (cards in review):' }),
    categories,
  )
}
