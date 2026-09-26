import { featureById, loadDeck } from './deck/load'
import type { Mode } from './deck/types'
import { addGuessLayer, addHighlightLayers, clearGuess, clearHighlight } from './map/highlight'
import { setLabelsVisible } from './map/labels'
import { createMap } from './map/map'
import { loadSettings, saveSettings } from './settings'
import { buildQueue } from './srs/queue'
import { applyReview, loadCards, syncCards } from './srs/store'
import { runSession, type ReviewItem, type SessionMode } from './ui/session'
import { renderDashboard } from './ui/dashboard'
import { renderSettings } from './ui/settings'

type Action = 'review' | Mode | 'settings' | 'progress'

export async function startApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <header>
      <h1>City Learner</h1>
      <p id="deck-label"></p>
      <nav class="modes">
        <button type="button" data-action="review">Review</button>
        <button type="button" data-action="identify">Identify</button>
        <button type="button" data-action="locate">Locate</button>
        <button type="button" data-action="progress">Progress</button>
        <button type="button" data-action="settings">Settings</button>
      </nav>
    </header>
    <main>
      <div id="map"></div>
      <aside id="panel" aria-label="Review"></aside>
    </main>
  `

  const mapContainer = root.querySelector<HTMLDivElement>('#map')
  const panel = root.querySelector<HTMLElement>('#panel')
  const deckLabel = root.querySelector<HTMLParagraphElement>('#deck-label')
  const actionButtons = root.querySelectorAll<HTMLButtonElement>('.modes button')
  if (!mapContainer || !panel || !deckLabel) throw new Error('Missing layout elements')

  const deck = await loadDeck(`${import.meta.env.BASE_URL}decks/toronto.json`)
  deckLabel.textContent = `${deck.city} — ${deck.features.length} features`

  let settings = await loadSettings()

  const map = createMap(mapContainer)
  window.cityLearner = { map, deck }

  const features = featureById(deck)
  let session: SessionMode | undefined

  const begin = (options: {
    items: ReviewItem[]
    finishMessage: string
    onAnswer?: (item: ReviewItem, correct: boolean) => void | Promise<void>
  }): void => {
    session?.stop()
    clearHighlight(map)
    clearGuess(map)
    setLabelsVisible(map, false)
    session = runSession(map, deck, panel, options.items, {
      onAnswer: options.onAnswer,
      finishMessage: options.finishMessage,
      tolerances: settings.tolerances,
    })
  }

  const startReview = async (mode?: Mode): Promise<void> => {
    await syncCards(deck)
    const cards = await loadCards()
    const items: ReviewItem[] = buildQueue(cards, {
      now: new Date(),
      mode,
      newLimit: settings.newLimit,
    }).map((card) => {
      const feature = features.get(card.featureId)
      if (!feature) throw new Error(`Unknown feature: ${card.featureId}`)
      return { feature, mode: card.mode, card }
    })

    begin({
      items,
      finishMessage: 'Nothing due right now — come back later.',
      onAnswer: async (item, correct) => {
        if (item.card) await applyReview(item.card, correct)
      },
    })
  }

  const startPanelView = (): void => {
    session?.stop()
    session = undefined
    clearHighlight(map)
    clearGuess(map)
    setLabelsVisible(map, false)
  }

  const startSettings = (): void => {
    startPanelView()
    void renderSettings(panel, async (next) => {
      await saveSettings(next)
      settings = next
      runAction('review')
    })
  }

  const startProgress = (): void => {
    startPanelView()
    void renderDashboard(panel, deck)
  }

  const startPractice = (mode: Mode): void => {
    begin({
      items: deck.features.map((feature) => ({ feature, mode })),
      finishMessage: 'Session complete',
    })
  }

  const actions: Record<Action, () => void | Promise<void>> = {
    review: () => startReview(),
    identify: () => startPractice('identify'),
    locate: () => startPractice('locate'),
    settings: startSettings,
    progress: startProgress,
  }

  const runAction = (action: Action): void => {
    for (const button of actionButtons) {
      const active = button.dataset.action === action
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    }
    void actions[action]()
  }

  map.once('style.load', () => {
    addHighlightLayers(map)
    addGuessLayer(map)
    for (const button of actionButtons) {
      button.addEventListener('click', () => runAction(button.dataset.action as Action))
    }
    runAction('review')
  })
}
