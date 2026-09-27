import { describe, expect, it } from 'vitest'
import { shuffle } from '../../src/deck/shuffle'

describe('shuffle', () => {
  it('returns a permutation of the same items', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = shuffle(input, () => 0.42)

    expect(result).toHaveLength(input.length)
    expect([...result].sort((a, b) => a - b)).toEqual(input)
  })

  it('does not mutate the input', () => {
    const input = [1, 2, 3]
    shuffle(input, () => 0)
    expect(input).toEqual([1, 2, 3])
  })

  it('is deterministic for a given random source', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1])
  })

  it('handles empty and single-item lists', () => {
    expect(shuffle([], () => 0)).toEqual([])
    expect(shuffle(['a'], () => 0)).toEqual(['a'])
  })
})
