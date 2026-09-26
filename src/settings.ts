import { z } from 'zod'
import { db } from './db/schema'
import { DEFAULT_NEW_LIMIT } from './srs/queue'

export const settingsSchema = z.object({
  newLimit: z.number().int().min(0).max(500),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = { newLimit: DEFAULT_NEW_LIMIT }

const SETTINGS_KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
  const record = await db.meta.get(SETTINGS_KEY)
  const parsed = settingsSchema.safeParse(record?.value)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.meta.put({ key: SETTINGS_KEY, value: settingsSchema.parse(settings) })
}
