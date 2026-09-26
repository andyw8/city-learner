import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'node_modules/maplibre-gl/dist')
const publicDir = resolve(root, 'data')

mkdirSync(publicDir, { recursive: true })

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(resolve(dist, file), resolve(publicDir, file))
}

console.log('Copied MapLibre worker assets to data/')
