import './style.css'
import { startApp } from './app'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app element')

startApp(app).catch((error: unknown) => {
  app.textContent = `Failed to start: ${String(error)}`
})
