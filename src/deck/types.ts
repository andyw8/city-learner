import { z } from 'zod'

export const CATEGORIES = ['road', 'neighbourhood', 'water', 'landmark'] as const

export const MODES = ['identify', 'locate'] as const

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: position }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(position).min(2) }),
  z.object({
    type: z.literal('MultiLineString'),
    coordinates: z.array(z.array(position).min(2)).min(1),
  }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(position).min(4)).min(1) }),
])

export const categorySchema = z.enum(CATEGORIES)

export const featureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  category: categorySchema,
  description: z.string(),
  noun: z.string().min(1).optional(),
  geometry: geometrySchema,
  osmId: z.string().min(1).optional(),
  toleranceM: z.number().positive().optional(),
})

export const deckSchema = z.object({
  city: z.string().min(1),
  version: z.number().int().positive(),
  features: z.array(featureSchema).min(1),
})

export type Position = z.infer<typeof position>
export type Geometry = z.infer<typeof geometrySchema>
export type Category = z.infer<typeof categorySchema>
export type Feature = z.infer<typeof featureSchema>
export type FeatureInput = z.input<typeof featureSchema>
export type Deck = z.infer<typeof deckSchema>
export type DeckInput = z.input<typeof deckSchema>
export type Mode = (typeof MODES)[number]

export type BBox = [number, number, number, number]
