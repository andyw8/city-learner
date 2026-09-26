import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
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
  })

  it('round-trips saved settings', async () => {
    await saveSettings({ newLimit: 25 })
    expect(await loadSettings()).toEqual({ newLimit: 25 })
  })

  it('rejects out-of-range values', async () => {
    await expect(saveSettings({ newLimit: 600 })).rejects.toThrow()
  })

  it('falls back to defaults for corrupt data', async () => {
    await db.meta.put({ key: 'settings', value: { newLimit: 'lots' } })
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
