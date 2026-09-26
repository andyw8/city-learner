import { loadDeck } from './deck/load'
import type { Mode } from './deck/types'
import { addGuessLayer, addHighlightLayers, clearGuess, clearHighlight } from './map/highlight'
import { setLabelsVisible } from './map/labels'
import { createMap } from './map/map'
import { startIdentify } from './ui/identify'
import { startLocate } from './ui/locate'
import type { SessionMode } from './ui/session'

export async function startApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <header>
      <h1>City Learner</h1>
      <p id="deck-label"></p>
      <nav class="modes">
        <button type="button" data-mode="identify">Identify</button>
        <button type="button" data-mode="locate">Locate</button>
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
  const modeButtons = root.querySelectorAll<HTMLButtonElement>('.modes button')
  if (!mapContainer || !panel || !deckLabel) throw new Error('Missing layout elements')

  const deck = await loadDeck('/decks/toronto.json')
  deckLabel.textContent = `${deck.city} — ${deck.features.length} features`

  const map = createMap(mapContainer)
  window.cityLearner = { map, deck }

  let session: SessionMode | undefined

  const startMode = (mode: Mode): void => {
    session?.stop()
    clearHighlight(map)
    clearGuess(map)
    setLabelsVisible(map, false)
    for (const button of modeButtons) {
      button.classList.toggle('active', button.dataset.mode === mode)
    }
    session =
      mode === 'identify' ? startIdentify(map, deck, panel) : startLocate(map, deck, panel)
  }

  map.once('style.load', () => {
    addHighlightLayers(map)
    addGuessLayer(map)
    for (const button of modeButtons) {
      button.addEventListener('click', () => startMode(button.dataset.mode as Mode))
    }
    startMode('identify')
  })
}
