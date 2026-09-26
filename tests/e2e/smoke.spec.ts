import { expect, test, type Page } from '@playwright/test'

async function chooseMultipleChoice(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Multiple choice' }).click()
}

async function currentFeatureName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const { deck, current } = window.cityLearner!
    return deck!.features.find((feature) => feature.id === current!.featureId)!.name
  })
}

test('app boots and loads the Toronto deck', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'City Learner' })).toBeVisible()
  await expect(page.getByText(/Toronto, Ontario, Canada — \d+ features/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Identify' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('switching city loads that city deck', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  await page.selectOption('#city-select', 'glasgow')
  await page.waitForFunction(() => window.cityLearner?.deck?.city.startsWith('Glasgow'))
  await expect(page.getByText(/Glasgow, Scotland — \d+ features/)).toBeVisible()
})

test('renders the basemap with no labels visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.map.isStyleLoaded() === true)

  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap')

  const visibleSymbols = await page.evaluate(
    () =>
      window.cityLearner!.map
        .getStyle()
        .layers.filter((l) => l.type === 'symbol' && l.layout?.visibility !== 'none').length,
  )
  expect(visibleSymbols).toBe(0)
})

test('labels are revealed after answering and hidden for the next question', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  await page.locator(`button[data-feature-id="${featureId}"]`).click()

  await page.waitForFunction(() =>
    window.cityLearner!.map
      .getStyle()
      .layers.some((l) => l.type === 'symbol' && l.layout?.visibility === 'visible'),
  )

  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForFunction(() =>
    window.cityLearner!.map
      .getStyle()
      .layers.filter((l) => l.type === 'symbol')
      .every((l) => l.layout?.visibility === 'none'),
  )
})

test('mode A: a correct answer is confirmed', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  await expect(page.locator('.options button')).toHaveCount(4)

  await page.locator(`button[data-feature-id="${featureId}"]`).click()
  await expect(page.locator('.feedback')).toContainText('Correct')
  await expect(page.locator('.options button.correct')).toHaveCount(1)
})

test('mode A: a wrong answer reveals the correct name', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  const wrongId = await page.evaluate((correct) => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.options button')]
    return buttons.find((button) => button.dataset.featureId !== correct)!.dataset.featureId!
  }, featureId)

  await page.locator(`button[data-feature-id="${wrongId}"]`).click()
  await expect(page.locator('.feedback')).toContainText('Not quite')
  await expect(page.locator(`button[data-feature-id="${featureId}"]`)).toHaveClass(/correct/)
})

test('mode A: free text is the default and accepts a correct name', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  await expect(page.getByRole('button', { name: 'Free text' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  const name = await currentFeatureName(page)
  await page.getByRole('textbox').fill(name)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.feedback')).toContainText('Correct')
})

test('mode A: free text tolerates a small typo', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current?.mode === 'identify')

  const name = await currentFeatureName(page)
  await page.getByRole('textbox').fill(name.slice(1))
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.feedback')).toContainText('Correct')
})

test('mode A: a wrong free-text answer reveals the name', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  const name = await currentFeatureName(page)
  await page.getByRole('textbox').fill('zzzzzz')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.feedback')).toContainText('Not quite')
  await expect(page.locator('.feedback')).toContainText(name)
})

test('mode A: switching to multiple choice shows options', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  await expect(page.locator('.options button')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Multiple choice' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
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

function reviewedCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('city-learner')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const getAll = db.transaction('cards', 'readonly').objectStore('cards').getAll()
          getAll.onsuccess = () =>
            resolve(
              (getAll.result as { reps: number }[]).filter((card) => card.reps > 0).length,
            )
          getAll.onerror = () => reject(getAll.error)
        }
      }),
  )
}

test('reviews are persisted to IndexedDB across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review' }).click()
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  await page.locator(`button[data-feature-id="${featureId}"]`).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect.poll(() => reviewedCount(page)).toBeGreaterThan(0)

  await page.reload()
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  expect(await reviewedCount(page)).toBeGreaterThan(0)
})

test('settings persist across reloads', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  await page.getByRole('button', { name: 'Settings' }).click()
  const input = page.locator('#new-limit')
  await expect(input).toBeVisible()
  await input.fill('3')
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(input).toHaveValue('3')

  await page.reload()
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.locator('#new-limit')).toHaveValue('3')
})

test('progress tab summarises the deck', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  await page.getByRole('button', { name: 'Progress' }).click()
  await expect(page.locator('#panel h2')).toHaveText('Progress')
  await expect(page.locator('.stats').first()).toBeVisible()
  await expect(page.locator('.by-category .category')).toHaveCount(4)
})

test('a finished review shows a session summary', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('#new-limit').fill('1')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForFunction(() => window.cityLearner?.current !== undefined)
  await chooseMultipleChoice(page)

  const featureId = await page.evaluate(() => window.cityLearner!.current!.featureId)
  await page.locator(`button[data-feature-id="${featureId}"]`).click()
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.locator('#panel .stats')).toContainText('Answered')
  await expect(page.locator('#panel .stats')).toContainText('Correct')
})
