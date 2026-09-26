import { describe, expect, it } from 'vitest'
import { matchesAnswer } from '../../src/deck/matching'
import type { Feature } from '../../src/deck/types'

function feature(name: string, aliases: string[] = []): Feature {
  return {
    id: name,
    name,
    aliases,
    category: 'road',
    description: '',
    geometry: { type: 'Point', coordinates: [0, 0] },
  }
}

const bathurst = feature('Bathurst Street')
const donValley = feature('Don Valley Parkway')
const kensington = feature('Kensington Market')
const highway401 = feature('Highway 401', ['401', 'The 401', "King's Highway 401"])
const cnTower = feature('CN Tower', ['The CN Tower'])

describe('matchesAnswer', () => {
  it('accepts the exact name, case-insensitively', () => {
    expect(matchesAnswer('Bathurst Street', bathurst)).toBe(true)
    expect(matchesAnswer('bathurst street', bathurst)).toBe(true)
    expect(matchesAnswer('  BATHURST STREET  ', bathurst)).toBe(true)
  })

  it('accepts the name without its generic road word', () => {
    expect(matchesAnswer('Bathurst', bathurst)).toBe(true)
    expect(matchesAnswer('Don Valley', donValley)).toBe(true)
  })

  it('expands common abbreviations', () => {
    expect(matchesAnswer('Bathurst St', bathurst)).toBe(true)
    expect(matchesAnswer('Don Valley Pkwy', donValley)).toBe(true)
  })

  it('accepts a prefix of a multi-word name', () => {
    expect(matchesAnswer('Kensington', kensington)).toBe(true)
  })

  it('accepts an alias and ignores a leading "the"', () => {
    expect(matchesAnswer('401', highway401)).toBe(true)
    expect(matchesAnswer('Hwy 401', highway401)).toBe(true)
    expect(matchesAnswer('The CN Tower', cnTower)).toBe(true)
    expect(matchesAnswer('cn tower', cnTower)).toBe(true)
  })

  it('tolerates small typos', () => {
    expect(matchesAnswer('Bathrst Street', bathurst)).toBe(true)
    expect(matchesAnswer('Kensingten', kensington)).toBe(true)
  })

  it('rejects unrelated answers', () => {
    expect(matchesAnswer('Dundas', bathurst)).toBe(false)
    expect(matchesAnswer('', bathurst)).toBe(false)
    expect(matchesAnswer('street', bathurst)).toBe(false)
    expect(matchesAnswer('Don River', donValley)).toBe(false)
  })
})
