import { z } from 'zod'
import { DEFAULT_TOLERANCE_M } from './deck/distance'
import { CATEGORIES } from './deck/types'
import { db } from './db/schema'
import { DEFAULT_NEW_LIMIT } from './srs/queue'

export const IDENTIFY_MODES = ['free-text', 'multiple-choice'] as const
export type IdentifyAnswerMode = (typeof IDENTIFY_MODES)[number]

export const IDENTIFY_MODE_LABELS: Record<IdentifyAnswerMode, string> = {
  'free-text': 'Free text',
  'multiple-choice': 'Multiple choice',
}

export const settingsSchema = z.object({
  newLimit: z.number().int().min(0).max(500),
  tolerances: z.record(z.enum(CATEGORIES), z.number().positive()),
  identifyMode: z.enum(IDENTIFY_MODES).default('free-text'),
})

export type Settings = z.output<typeof settingsSchema>
export type SettingsInput = z.input<typeof settingsSchema>
export type Tolerances = Settings['tolerances']

export const DEFAULT_SETTINGS: Settings = {
  newLimit: DEFAULT_NEW_LIMIT,
  tolerances: DEFAULT_TOLERANCE_M,
  identifyMode: 'free-text',
}

const SETTINGS_KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
  const record = await db.meta.get(SETTINGS_KEY)
  const parsed = settingsSchema.safeParse(record?.value)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

export async function saveSettings(settings: SettingsInput): Promise<void> {
  await db.meta.put({ key: SETTINGS_KEY, value: settingsSchema.parse(settings) })
}
