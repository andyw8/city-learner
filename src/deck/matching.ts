import type { Feature } from './types'

const ABBREVIATIONS: Record<string, string> = {
  st: 'street',
  str: 'street',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  blvd: 'boulevard',
  boul: 'boulevard',
  dr: 'drive',
  hwy: 'highway',
  pkwy: 'parkway',
  cres: 'crescent',
  ct: 'court',
  pl: 'place',
  sq: 'square',
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
}

const GENERIC_TOKENS = new Set([
  'street',
  'avenue',
  'road',
  'boulevard',
  'drive',
  'highway',
  'parkway',
  'crescent',
  'court',
  'place',
  'square',
  'lane',
  'way',
  'trail',
  'gardens',
  'north',
  'south',
  'east',
  'west',
  'the',
])

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll(/['’]/g, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
    .replaceAll(/\s+/g, ' ')
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .map((token) => ABBREVIATIONS[token] ?? token)
}

function coreTokens(value: string): string[] {
  return tokenize(value).filter((token) => !GENERIC_TOKENS.has(token))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      const insertion = (current[j - 1] ?? 0) + 1
      const deletion = (previous[j] ?? 0) + 1
      current[j] = Math.min(substitution, insertion, deletion)
    }
    previous = current
  }

  return previous[b.length] ?? Math.max(a.length, b.length)
}

function maxEdits(length: number): number {
  if (length <= 4) return 0
  if (length <= 7) return 1
  return 2
}

function isTypo(given: string, target: string): boolean {
  if (given.length === 0 || target.length === 0) return false
  return levenshtein(given, target) <= maxEdits(Math.max(given.length, target.length))
}

function tokensClose(given: string, target: string): boolean {
  return given === target || isTypo(given, target)
}

function isPrefixMatch(given: string[], target: string[]): boolean {
  if (given.length === 0 || given.length > target.length) return false
  return given.every((token, index) => tokensClose(token, target[index]!))
}

function matchesCandidate(answer: string, candidate: string): boolean {
  const target = normalize(candidate)
  if (target.length === 0) return false
  if (answer === target) return true
  if (target.startsWith(`${answer} `)) return true
  if (isPrefixMatch(coreTokens(answer), coreTokens(candidate))) return true
  return isTypo(answer, target)
}

export function matchesAnswer(input: string, feature: Feature): boolean {
  const answer = normalize(input)
  if (answer.length === 0) return false
  return [feature.name, ...feature.aliases].some((candidate) =>
    matchesCandidate(answer, candidate),
  )
}
