import { expect, test } from '@playwright/test'

test('app boots and loads the Toronto deck', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'City Learner' })).toBeVisible()
  await expect(page.getByText('Toronto, Ontario, Canada — 13 features')).toBeVisible()
})

test('renders the unlabelled PMTiles basemap', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.map.isStyleLoaded() === true)

  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap')

  const symbols = await page.evaluate(
    () => window.cityLearner!.map.getStyle().layers.filter((l) => l.type === 'symbol').length,
  )
  expect(symbols).toBe(0)
})

test('mode A: a correct answer is confirmed', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  await expect(page.locator('.options button')).toHaveCount(4)

  await page.locator(`button[data-feature-id="${featureId}"]`).click()
  await expect(page.locator('.feedback')).toContainText('Correct')
  await expect(page.locator('.options button.correct')).toHaveCount(1)
})

test('mode A: a wrong answer reveals the correct name', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  const wrongId = await page.evaluate((correct) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.options button')]
    return buttons.find((button) => button.dataset.featureId !== correct)!.dataset.featureId!
  }, featureId)

  await page.locator(`button[data-feature-id="${wrongId}"]`).click()
  await expect(page.locator('.feedback')).toContainText('Not quite')
  await expect(page.locator(`button[data-feature-id="${featureId}"]`)).toHaveClass(/correct/)
})

async function startLocate(page: import('@playwright/test').Page): Promise<[number, number]> {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await page.getByRole('button', { name: 'Locate' }).click()
  await page.waitForFunction(() => window.cityLearner?.current?.mode === 'locate')

  return page.evaluate(() => {
    const { map, deck, current } = window.cityLearner!
    const feature = deck!.features.find((f) => f.id === current!.featureId)!
    const geometry = feature.geometry
    const coordinate =
      geometry.type === 'Point'
        ? geometry.coordinates
        : geometry.type === 'LineString'
          ? geometry.coordinates[0]
          : geometry.coordinates[0]![0]
    const projected = map.project(coordinate as [number, number])
    const rect = document.querySelector('canvas')!.getBoundingClientRect()
    return [rect.left + projected.x, rect.top + projected.y]
  })
}

test('mode B: clicking the feature location is correct', async ({ page }) => {
  const [x, y] = await startLocate(page)
  await page.mouse.click(x, y)
  await expect(page.locator('.feedback')).toContainText('Correct')
})

test('mode B: clicking far away is incorrect and reveals the target', async ({ page }) => {
  await startLocate(page)
  const box = await page.locator('canvas.maplibregl-canvas').boundingBox()
  await page.mouse.click(box!.x + 20, box!.y + 20)
  await expect(page.locator('.feedback')).toContainText('Not quite')
})
