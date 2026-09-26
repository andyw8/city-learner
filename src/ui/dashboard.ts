import type { Deck } from '../deck/types'
import { summarize } from '../srs/stats'
import { loadCards } from '../srs/store'
import { el, statTile } from './dom'

export async function renderDashboard(panel: HTMLElement, deck: Deck): Promise<void> {
  const cards = await loadCards()
  const stats = summarize(deck, cards, new Date())

  const totals = el('div', { className: 'stats' }, [
    statTile('Cards', stats.total),
    statTile('Due now', stats.due),
    statTile('New', stats.fresh),
    statTile('Learning', stats.learning),
    statTile('In review', stats.review),
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
