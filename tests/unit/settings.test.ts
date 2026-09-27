import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TOLERANCE_M } from '../../src/deck/distance'
import { db } from '../../src/db/schema'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/settings'
import { DEFAULT_NEW_LIMIT } from '../../src/srs/queue'

describe('settings', () => {
  beforeEach(async () => {
    await db.meta.clear()
  })

  it('returns defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.newLimit).toBe(DEFAULT_NEW_LIMIT)
    expect(DEFAULT_SETTINGS.tolerances).toEqual(DEFAULT_TOLERANCE_M)
  })

  it('round-trips saved settings', async () => {
    const settings = {
      newLimit: 25,
      tolerances: { ...DEFAULT_TOLERANCE_M, road: 100 },
      city: 'glasgow',
    }
    await saveSettings(settings)
    expect(await loadSettings()).toEqual(settings)
  })

  it('rejects out-of-range values', async () => {
    await expect(
      saveSettings({ newLimit: 600, tolerances: DEFAULT_TOLERANCE_M }),
    ).rejects.toThrow()
    await expect(
      saveSettings({ newLimit: 10, tolerances: { ...DEFAULT_TOLERANCE_M, road: 0 } }),
    ).rejects.toThrow()
  })

  it('falls back to defaults for corrupt data', async () => {
    await db.meta.put({ key: 'settings', value: { newLimit: 'lots' } })
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
